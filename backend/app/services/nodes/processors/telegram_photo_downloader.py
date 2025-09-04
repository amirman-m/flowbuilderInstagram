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


def get_telegram_photo_downloader_node_type() -> NodeType:
    return NodeType(
        id="download_telegram_photo",
        name="Download Telegram Photo",
        description="Downloads Telegram photo by file_id and returns message_data with base64 image.",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="download",
        color="#FF6B35",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Telegram message_data containing photo_input with file_id",
                    data_type=[NodeDataType.OBJECT],
                    required=True,
                )
            ],
            outputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Original message_data with photo_input replaced by base64 data URI",
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

    Prefers settings.access_token, then settings.config_name with user_id, then
    default_flow_id mapping using flow_id + user_id. As a final fallback, scans the
    flow's telegram_input node settings for an access_token.
    """
    try:
        # Access node settings merged into context by FlowExecutor
        settings = context.get("settings", {})
        config_name = context.get("config_name") or settings.get("config_name")

        # Try to get user_id/flow_id if present in context
        user_id = context.get("user_id") or context.get("userId")
        flow_id = context.get("flow_id") or context.get("flowId")

        # 0) Immediate: allow explicit access_token in this node's settings
        if isinstance(settings, dict) and settings.get("access_token"):
            return settings.get("access_token")

        # Access DB
        from app.core.database import SessionLocal
        from app.models.telegram_bot import TelegramBotConfig
        from app.models.nodes import NodeInstance

        db = SessionLocal()
        try:
            logger.debug("[DEBUG] Token resolve: settings=%s config_name=%s user_id=%s flow_id=%s",
                         settings, config_name, user_id, flow_id)
            # 1) Preferred: config_name owned by user
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
                logger.debug("[DEBUG] Token resolve: config_name lookup result=%s", bool(row))
                if row and row.access_token:
                    return row.access_token

            # 2) Fallback: default_flow_id mapping for this user/flow
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
                logger.debug("[DEBUG] Token resolve: default_flow mapping result=%s", bool(row))
                if row and row.access_token:
                    return row.access_token

            # 3) Final fallback: look for a telegram_input node in this flow and read its settings.access_token
            if flow_id:
                tg_node = (
                    db.query(NodeInstance)
                    .filter(
                        NodeInstance.flow_id == int(flow_id),
                        NodeInstance.type_id == "telegram_input",
                    )
                    .first()
                )
                logger.debug("[DEBUG] Token resolve: telegram_input node found=%s", bool(tg_node))
                if tg_node and isinstance(tg_node.data, dict):
                    node_settings = tg_node.data.get("settings", {})
                    logger.debug("[DEBUG] Token resolve: telegram_input node has access_token=%s",
                                 bool(isinstance(node_settings, dict) and node_settings.get("access_token")))
                    if isinstance(node_settings, dict) and node_settings.get("access_token"):
                        return node_settings.get("access_token")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"[DEBUG] Failed to resolve Telegram bot token: {e}")

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

            # Determine MIME type for photos
            content_type = fresp.headers.get("Content-Type")
            if content_type:
                mime_type = content_type
            elif file_path.lower().endswith(('.jpg', '.jpeg')):
                mime_type = "image/jpeg"
            elif file_path.lower().endswith('.png'):
                mime_type = "image/png"
            elif file_path.lower().endswith('.webp'):
                mime_type = "image/webp"
            elif file_path.lower().endswith('.gif'):
                mime_type = "image/gif"
            else:
                mime_type = "image/jpeg"  # Default for Telegram photos

            return fresp.content, mime_type, file_path
    except Exception as e:
        logger.error(f"Telegram file download error: {e}")
        return None, None, None


async def execute_telegram_photo_downloader(context: Dict[str, Any]) -> NodeExecutionResult:
    """Download Telegram photo by file_id, return message_data with base64 data URI.

    Expected input: inputs.message_data from telegram_input with photo_input = { file_id, ... }
    Output: message_data with photo_input replaced by a base64 data URI string (data:<mime>;base64,<...>)
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

        # Validate presence of photo_input and file_id
        photo_meta = message_data.get("photo_input")
        if not isinstance(photo_meta, dict):
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="message_data.photo_input is required",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            )

        # Handle Telegram photo structure: photo_input.best.file_id or direct file_id
        file_id = None
        if isinstance(photo_meta.get("best"), dict) and photo_meta["best"].get("file_id"):
            file_id = photo_meta["best"]["file_id"]
        elif photo_meta.get("file_id"):
            file_id = photo_meta.get("file_id")
        
        if not file_id:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="message_data.photo_input must contain file_id (either direct or in 'best' photo)",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            )

        # Resolve bot token from DB
        access_token = await _resolve_bot_token(context)
        if not access_token:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Unable to resolve Telegram bot access token. Provide settings.access_token or settings.config_name, or ensure a Telegram Input node or DB config maps to this flow.",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            )

        # Download file bytes
        content, mime_type, file_path = await _download_telegram_file(access_token, file_id)
        if not content:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Failed to download Telegram photo file",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            )

        # Get file extension from MIME type
        def get_file_extension(mime_type: str) -> str:
            """Get file extension from MIME type."""
            mime_lower = mime_type.lower()
            if "jpeg" in mime_lower or "jpg" in mime_lower:
                return "jpg"
            elif "png" in mime_lower:
                return "png"
            elif "webp" in mime_lower:
                return "webp"
            elif "gif" in mime_lower:
                return "gif"
            else:
                return "jpg"  # Default for photos

        # Determine proper MIME type and extension
        original_mime = mime_type or photo_meta.get("mime_type") or "image/jpeg"
        file_ext = get_file_extension(original_mime)
        
        # Build data URI with proper MIME type and file extension hint
        b64 = base64.b64encode(content).decode("ascii")
        data_uri = f"data:{original_mime};name=photo.{file_ext};base64,{b64}"

        # Prepare output message_data: keep original fields, replace photo_input with the data string
        out_message_data = dict(message_data)
        out_message_data["photo_input"] = data_uri
        # Also include metadata block if useful
        meta = dict(out_message_data.get("metadata") or {})
        meta.update({
            "telegram_file_path": file_path,
            "telegram_file_id": file_id,
            "mime_type": original_mime,
            "file_extension": file_ext,
            "original_mime_type": original_mime,
        })
        out_message_data["metadata"] = meta
        out_message_data["input_type"] = "photo"

        return NodeExecutionResult(
            outputs={"message_data": out_message_data},
            status="success",
            logs=[
                f"Downloaded Telegram photo file {file_id} ({original_mime}) and attached as base64 data URI with .{file_ext} extension",
            ],
            started_at=started,
            completed_at=datetime.now(timezone.utc),
        )
    except Exception as e:
        logger.error(f"Error in execute_telegram_photo_downloader: {e}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=str(e),
            started_at=started,
            completed_at=datetime.now(timezone.utc),
        )
