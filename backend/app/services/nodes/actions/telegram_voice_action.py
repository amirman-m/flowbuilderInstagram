import base64
import io
import json
import logging
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import requests

from ....models.nodes import (
    NodeType,
    NodeCategory,
    NodeDataType,
    NodePort,
    NodePorts,
    NodeExecutionResult,
)

logger = logging.getLogger(__name__)


def get_telegram_output_voice_node_type() -> NodeType:
    return NodeType(
        id="send_telegram_voice",
        name="Send Telegram Voice",
        description="Send a voice message to a Telegram chat using the Bot API",
        category=NodeCategory.ACTION,
        version="1.0.0",
        icon="telegram",
        color="#4CAF50",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="voice",
                    name="voice",
                    label="Voice",
                    description="Voice payload (expects OGG/Opus as data URI string or base64)",
                    data_type=[NodeDataType.OBJECT],
                    required=True,
                )
            ],
            outputs=[],
        ),
        settings_schema={
            "type": "object",
            "properties": {
                "access_token": {
                    "type": "string",
                    "title": "Bot Access Token",
                    "description": "Telegram Bot API access token (from @BotFather)",
                    "minLength": 1,
                },
                "chat_id": {
                    "type": "string",
                    "title": "Chat ID",
                    "description": "Telegram Chat ID to send voice to (optional if connected to Telegram Input node)",
                },
                "caption": {
                    "type": "string",
                    "title": "Caption",
                    "description": "Optional caption for the voice message",
                },
                "parse_mode": {
                    "type": "string",
                    "title": "Parse Mode",
                    "description": "Caption parse mode (Markdown or HTML)",
                    "enum": ["Markdown", "HTML"],
                    "default": "Markdown",
                },
            },
            "required": [],
        },
    )


def _extract_inputs_from_context(context: Dict[str, Any]) -> Tuple[Dict[str, Any], Optional[int]]:
    settings = context.get("settings", {})
    flow_id = context.get("flow_id") or context.get("flowId")
    if isinstance(context.get("inputs"), dict):
        inputs = context.get("inputs", {})
        logger.info("Using primary 'inputs' from context['inputs']")
    else:
        system_keys = {"node_id", "flow_id", "settings", "flowId", "inputs"}
        inputs = {k: v for k, v in context.items() if k not in system_keys}
        logger.info("Using flattened inputs from top-level context (fallback)")
    logger.info(f"Inputs keys: {list(inputs.keys())}; flow_id: {flow_id}")
    return inputs, flow_id


def _find_credentials(inputs: Dict[str, Any], settings: Dict[str, Any], flow_id: Optional[int]) -> Tuple[Optional[str], Optional[Any]]:
    access_token = settings.get("access_token")
    chat_id = settings.get("chat_id")

    if not access_token or not chat_id:
        logger.info(f"Searching for chat_id and access_token in inputs: {list(inputs.keys())}")
        for port_id, port_data in inputs.items():
            if isinstance(port_data, dict):
                # direct props
                if "chat_id" in port_data and not chat_id:
                    chat_id = port_data["chat_id"]
                if "access_token" in port_data and not access_token:
                    access_token = port_data["access_token"]

                # from metadata
                if isinstance(port_data.get("metadata"), dict):
                    md = port_data["metadata"]
                    if not chat_id and "chat_id" in md:
                        chat_id = md["chat_id"]
                    if not access_token and "access_token" in md:
                        access_token = md["access_token"]

                # search by session id via DB (same pattern as message action)
                session_id = port_data.get("session_id")
                if not (access_token and chat_id) and flow_id and session_id:
                    try:
                        from sqlalchemy.orm import Session
                        from ....core.database import get_db
                        from ....models.node_instance import NodeInstance

                        db = next(get_db())
                        telegram_nodes = (
                            db.query(NodeInstance)
                            .filter(NodeInstance.flow_id == flow_id, NodeInstance.type_id == "telegram_input")
                            .all()
                        )
                        for tg_node in telegram_nodes:
                            node_data = tg_node.data
                            if isinstance(node_data, dict):
                                last_exec = node_data.get("lastExecution", {})
                                if isinstance(last_exec, dict):
                                    outputs = last_exec.get("outputs", {})
                                    message_data = outputs.get("message_data", {})
                                    if isinstance(message_data, dict) and message_data.get("session_id") == session_id:
                                        if not chat_id and "chat_id" in message_data:
                                            chat_id = message_data["chat_id"]
                                if not access_token:
                                    settings_data = node_data.get("settings", {})
                                    if "access_token" in settings_data:
                                        access_token = settings_data["access_token"]
                        db.close()
                    except Exception as e:
                        logger.error(f"Error searching for Telegram session data: {e}")

    # try int conversion
    if chat_id and isinstance(chat_id, str):
        try:
            chat_id = int(chat_id)
        except ValueError:
            pass

    return access_token, chat_id


def _extract_voice_payload(inputs: Dict[str, Any]) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Try to find a voice payload in inputs.
    Acceptable formats:
    - Data URI: data:audio/ogg;base64,<...> or data:audio/opus;base64,<...>
    - Plain base64 string (assumed opus/ogg)
    - Objects containing keys like voice_output, voice, audio, data_uri

    Returns: (audio_bytes, mime)
    """
    candidates = []
    for port_id, value in inputs.items():
        if isinstance(value, str) and value.strip():
            candidates.append(value.strip())
        elif isinstance(value, dict):
            # Prefer explicit keys often used by upstream nodes
            for key in ["voice_output", "voice", "audio", "data_uri", "url", "audio_data", "voice_data"]:
                if isinstance(value.get(key), str) and value[key].strip():
                    candidates.append(value[key].strip())
            # Look inside message_data
            md = value.get("message_data")
            if isinstance(md, dict):
                for key in ["voice_output", "voice", "audio", "data_uri", "audio_data", "voice_input"]:
                    if isinstance(md.get(key), str) and md[key].strip():
                        candidates.append(md[key].strip())

    for cand in candidates:
        # Data URI path
        if cand.startswith("data:") and ";base64," in cand:
            header, b64 = cand.split(",", 1)
            mime = header[5:].split(";")[0].lower()
            try:
                audio_bytes = base64.b64decode(b64)
                return audio_bytes, mime
            except Exception:
                continue
        # Plain base64 (best effort)
        try:
            audio_bytes = base64.b64decode(cand)
            # Unknown mime; assume opus
            return audio_bytes, "audio/ogg"
        except Exception:
            continue

    return None, None


async def execute_telegram_output_voice(context: Dict[str, Any]) -> NodeExecutionResult:
    try:
        logger.info(f"🔍 FULL EXECUTION CONTEXT (voice): { {k: (v if k!='inputs' else list(v.keys()) if isinstance(v, dict) else type(v)) for k,v in context.items()} }")
        settings = context.get("settings", {})
        inputs, flow_id = _extract_inputs_from_context(context)

        # Find credentials
        access_token, chat_id = _find_credentials(inputs, settings, flow_id)

        if not flow_id:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Missing flow_id in execution context. Please ensure the node is executed within a flow.",
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )

        if not access_token:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No Telegram access_token found. Please configure it in node settings or connect to a Telegram Input node.",
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )

        if not chat_id:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No Telegram chat_id found. Please configure it in node settings or connect to a Telegram Input node.",
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )

        # Extract voice payload
        audio_bytes, mime = _extract_voice_payload(inputs)
        if not audio_bytes:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No valid voice payload found in inputs. Provide a data URI or base64-encoded OGG/Opus audio.",
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )

        # Validate format is acceptable for Telegram (OGG/Opus)
        mime_lower = (mime or "").lower()
        if not ("audio/ogg" in mime_lower or "audio/opus" in mime_lower):
            # Hint: configure OpenAI Speech to response_format 'opus'
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Unsupported audio format. Telegram requires an OGG file encoded with Opus. Configure upstream to output 'opus' (OGG/Opus).",
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )

        # Telegram API endpoint for sending voice
        url = f"https://api.telegram.org/bot{access_token}/sendVoice"

        # Files: name the file with .ogg and use appropriate mime
        file_mime = "audio/ogg"
        files = {
            "voice": ("voice.ogg", io.BytesIO(audio_bytes), file_mime),
        }

        # Prepare the payload
        payload = {
            "chat_id": chat_id,
        }
        caption = settings.get("caption")
        parse_mode = settings.get("parse_mode") or "Markdown"
        if caption:
            payload["caption"] = caption
            payload["parse_mode"] = parse_mode

        logger.info(f"Sending voice to Telegram chat {chat_id}")
        response = requests.post(url, data=payload, files=files)

        if response.status_code == 200:
            result = response.json()
            timestamp = datetime.now(timezone.utc).isoformat()
            output_data = {
                "success": True,
                "chat_id": chat_id,
                "timestamp": timestamp,
                "response": result,
            }
            return NodeExecutionResult(
                outputs={"telegram_result": output_data},
                status="success",
                logs=["Voice sent successfully"],
            )
        else:
            error_message = f"Failed to send voice: {getattr(response, 'text', str(response))}"
            logger.error(error_message)
            return NodeExecutionResult(
                outputs={},
                status="error",
                error=error_message,
            )

    except Exception as e:
        logger.error(f"Error in telegram_voice_action: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Error sending Telegram voice: {str(e)}",
        )
