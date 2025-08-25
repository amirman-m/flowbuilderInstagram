from typing import Dict, Any, Optional
from datetime import datetime, timezone
import base64
import httpx
import logging

from app.models.nodes import (
    NodeType,
    NodeCategory,
    NodeDataType,
    NodePort,
    NodePorts,
    NodeExecutionResult,
)

logger = logging.getLogger(__name__)


def get_telegram_voice_downloader_node_type() -> NodeType:
    return NodeType(
        id="download_telegram_voice",
        name="Download Telegram Voice",
        description="Downloads Telegram voice by file_id and returns message_data with base64 audio.",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="download",
        color="#6A5ACD",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Telegram message_data containing voice_input with file_id",
                    data_type=[NodeDataType.OBJECT],
                    required=True,
                )
            ],
            outputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Original message_data with voice_input replaced by base64 data URI",
                    data_type=[NodeDataType.OBJECT],
                    required=True,
                )
            ],
        ),
        settingsSchema={
            "type": "object",
            "properties": {},  # No settings
            "required": []
        },
    )


async def _resolve_bot_token(context: Dict[str, Any]) -> Optional[str]:
    """Resolve Telegram bot access token from DB via config_name or default flow mapping.

    Prefers settings.config_name. If absent, try to use flow_id (if provided in context)
    to find a TelegramBotConfig whose default_flow_id matches.
    """
    try:
        # Access node settings merged into context by FlowExecutor
        settings = context.get("settings", {})
        config_name = context.get("config_name") or settings.get("config_name")

        # Try to get user_id/flow_id if present in context
        user_id = context.get("user_id") or context.get("userId")
        flow_id = context.get("flow_id") or context.get("flowId")

        # Access DB
        from app.core.database import SessionLocal
        from app.models.telegram_bot import TelegramBotConfig

        db = SessionLocal()
        try:
            if config_name and user_id:
                row = (
                    db.query(TelegramBotConfig)
                    .filter(
                        TelegramBotConfig.user_id == int(user_id),
                        TelegramBotConfig.config_name == config_name,
                        TelegramBotConfig.is_active == True,
                    )
                    .first()
                )
                if row and row.access_token:
                    return row.access_token

            # Fallback: try default_flow_id mapping if flow_id present
            if flow_id and user_id:
                row = (
                    db.query(TelegramBotConfig)
                    .filter(
                        TelegramBotConfig.user_id == int(user_id),
                        TelegramBotConfig.default_flow_id == int(flow_id),
                        TelegramBotConfig.is_active == True,
                    )
                    .first()
                )
                if row and row.access_token:
                    return row.access_token
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to resolve Telegram bot token: {e}")

    return None


async def _download_telegram_file(access_token: str, file_id: str) -> tuple[Optional[bytes], Optional[str], Optional[str]]:
    """Use Telegram Bot API to resolve file_path and download the file.

    Returns: (bytes, mime_type, file_path) or (None, None, None) on error.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1) getFile to resolve file_path
            resp = await client.get(
                f"https://api.telegram.org/bot{access_token}/getFile",
                params={"file_id": file_id},
            )
            if resp.status_code != 200 or not resp.json().get("ok"):
                logger.error(f"getFile failed: {resp.text}")
                return None, None, None
            file_path = resp.json().get("result", {}).get("file_path")
            if not file_path:
                return None, None, None

            # 2) download the file
            file_url = f"https://api.telegram.org/file/bot{access_token}/{file_path}"
            fresp = await client.get(file_url)
            if fresp.status_code != 200:
                logger.error(f"Download failed: {fresp.text}")
                return None, None, None

            # Heuristic mime type for voice messages
            # Telegram voice is commonly OGG/Opus
            mime_type = fresp.headers.get("Content-Type") or "audio/ogg"
            return fresp.content, mime_type, file_path
    except Exception as e:
        logger.error(f"Telegram file download error: {e}")
        return None, None, None


async def execute_telegram_voice_downloader(context: Dict[str, Any]) -> NodeExecutionResult:
    """Download Telegram voice by file_id, return message_data with base64 data URI.

    Expected input: inputs.message_data from telegram_input with voice_input = { file_id, ... }
    Output: message_data with voice_input replaced by a base64 data URI string (data:<mime>;base64,<...>)
    """
    started = datetime.now(timezone.utc)

    try:
        inputs = context.get("inputs", {})
        message_data = None

        # Extract incoming message_data from any input port named message_data
        for port_id, value in inputs.items():
            if port_id == "message_data" and isinstance(value, dict):
                message_data = value
                break
            # Fallback: sometimes inputs are nested like { somePort: { message_data: {...} } }
            if isinstance(value, dict) and "message_data" in value and isinstance(value["message_data"], dict):
                message_data = value["message_data"]
                break

        if not message_data:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No message_data found in inputs",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            )

        # Validate presence of voice_input and file_id
        voice_meta = message_data.get("voice_input")
        if not isinstance(voice_meta, dict) or not voice_meta.get("file_id"):
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="message_data.voice_input with file_id is required",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            )

        file_id = voice_meta.get("file_id")

        # Resolve bot token from DB
        access_token = await _resolve_bot_token(context)
        if not access_token:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Unable to resolve Telegram bot access token. Provide settings.config_name or ensure default_flow_id is set on a Telegram bot config.",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            )

        # Download file bytes
        content, mime_type, file_path = await _download_telegram_file(access_token, file_id)
        if not content:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Failed to download Telegram voice file",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            )

        # Build data URI
        b64 = base64.b64encode(content).decode("ascii")
        mime = mime_type or voice_meta.get("mime_type") or "audio/ogg"
        data_uri = f"data:{mime};base64,{b64}"

        # Prepare output message_data: keep original fields, replace voice_input with the data string
        out_message_data = dict(message_data)
        out_message_data["voice_input"] = data_uri
        # Also include metadata block if useful
        meta = dict(out_message_data.get("metadata") or {})
        meta.update({
            "telegram_file_path": file_path,
            "telegram_file_id": file_id,
            "mime_type": mime,
        })
        out_message_data["metadata"] = meta
        out_message_data["input_type"] = "voice"

        return NodeExecutionResult(
            outputs={"message_data": out_message_data},
            status="success",
            logs=[
                f"Downloaded Telegram voice file {file_id} ({mime}) and attached as base64 data URI",
            ],
            started_at=started,
            completed_at=datetime.now(timezone.utc),
        )
    except Exception as e:
        logger.error(f"Error in execute_telegram_voice_downloader: {e}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=str(e),
            started_at=started,
            completed_at=datetime.now(timezone.utc),
        )
