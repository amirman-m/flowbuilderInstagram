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


def get_telegram_send_photo_node_type() -> NodeType:
    return NodeType(
        id="send_telegram_photo",
        name="Send Telegram Photo",
        description="Send a photo with optional caption to a Telegram chat using the Bot API",
        category=NodeCategory.ACTION,
        version="1.0.0",
        icon="telegram",
        color="#4CAF50",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="photo",
                    name="photo",
                    label="Photo*",
                    description="Photo payload (expects base64 data URI or image bytes)",
                    data_type=[NodeDataType.OBJECT, NodeDataType.STRING],
                    required=True,
                ),
                NodePort(
                    id="caption",
                    name="caption",
                    label="Caption",
                    description="Optional caption text for the photo",
                    data_type=[NodeDataType.STRING, NodeDataType.OBJECT],
                    required=False,
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
                    "description": "Telegram Chat ID to send photo to (optional if connected to Telegram Input node)",
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
    access_token = None
    chat_id = settings.get("chat_id")
    
    # Check for flow-level telegram config first
    if flow_id:
        try:
            from app.core.database import get_db
            from app.models.telegram_bot import TelegramBotConfig
            db = next(get_db())
            
            # Get user_id from context or hardcoded for now
            user_id = 1  # TODO: get from auth context
            
            flow_bot_config = db.query(TelegramBotConfig).filter(
                TelegramBotConfig.user_id == user_id,
                TelegramBotConfig.default_flow_id == flow_id,
                TelegramBotConfig.is_active == True
            ).first()
            
            if flow_bot_config:
                access_token = flow_bot_config.access_token
                logger.info(f"Using flow-level telegram config: {flow_bot_config.config_name}")
            
            db.close()
        except Exception as e:
            logger.error(f"Error checking flow-level telegram config: {e}")
    
    # Fallback to node settings
    if not access_token:
        access_token = settings.get("access_token")

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

                # search by session id via DB (same pattern as other actions)
                session_id = port_data.get("session_id")
                if not (access_token and chat_id) and flow_id and session_id:
                    try:
                        from sqlalchemy.orm import Session
                        from ....core.database import get_db
                        from app.models.nodes import NodeInstance

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

    # If we still don't have the credentials, search all nodes in the flow
    if (not access_token or not chat_id) and flow_id:
        logger.info(f"Searching for Telegram input node in flow {flow_id}")
        try:
            from sqlalchemy.orm import Session
            from ....core.database import get_db
            from app.models.nodes import NodeInstance
            import json
            
            db = next(get_db())
            
            # Query the database for nodes in this flow
            nodes = db.query(NodeInstance).filter(NodeInstance.flow_id == flow_id).all()
            logger.info(f"Found {len(nodes)} nodes in flow {flow_id}")
            
            # Find the telegram_input node
            for node in nodes:
                logger.info(f"node.type_id: {node.type_id}")
                if node.type_id == "telegram_input":
                    logger.info(f"Found telegram_input node: {node.id}")
                    node_data = node.data
                    
                    # Convert from JSON string if needed
                    if isinstance(node_data, str):
                        try:
                            node_data = json.loads(node_data)
                        except:
                            logger.error("Failed to parse node data JSON")
                            node_data = {}
                    
                    # Check for access_token in settings
                    if not access_token and node_data and "settings" in node_data:
                        node_settings = node_data["settings"]
                        if isinstance(node_settings, str):
                            try:
                                node_settings = json.loads(node_settings)
                            except:
                                node_settings = {}
                                
                        access_token = node_settings.get("access_token")
                        if access_token:
                            logger.info("Found access_token in telegram_input node settings")
                    
                    # Check for chat_id in lastExecution
                    if not chat_id and node_data and "lastExecution" in node_data:
                        last_exec = node_data["lastExecution"]
                        if isinstance(last_exec, str):
                            try:
                                last_exec = json.loads(last_exec)
                            except:
                                last_exec = {}
                                
                        if last_exec and "outputs" in last_exec and "message_data" in last_exec["outputs"]:
                            message_data = last_exec["outputs"]["message_data"]
                            if isinstance(message_data, str):
                                try:
                                    message_data = json.loads(message_data)
                                except:
                                    message_data = {}
                                    
                            if isinstance(message_data, dict) and "chat_id" in message_data:
                                chat_id = message_data["chat_id"]
                                logger.info(f"Found chat_id from telegram_input node lastExecution: {chat_id}")
                    
                    # Break if we found both
                    if access_token and chat_id:
                        break
                        
            db.close()
        except Exception as e:
            logger.error(f"Error searching for Telegram input node: {e}")

    # try int conversion
    if chat_id and isinstance(chat_id, str):
        try:
            chat_id = int(chat_id)
        except ValueError:
            pass

    return access_token, chat_id


def _extract_photo_payload(inputs: Dict[str, Any]) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Try to find a photo payload in inputs.
    Acceptable formats:
    - Data URI: data:image/jpeg;base64,<...> or data:image/png;base64,<...>
    - Plain base64 string (assumed JPEG)
    - Objects containing keys like photo_input, photo, image, data_uri

    Returns: (image_bytes, mime)
    """
    candidates = []
    
    # Check the photo port specifically first
    photo_input = inputs.get("photo")
    if photo_input:
        if isinstance(photo_input, str) and photo_input.strip():
            candidates.append(photo_input.strip())
        elif isinstance(photo_input, dict):
            # Look for common photo keys
            for key in ["photo_input", "photo", "image", "data_uri", "url", "image_data", "photo_data"]:
                if isinstance(photo_input.get(key), str) and photo_input[key].strip():
                    candidates.append(photo_input[key].strip())
            # Look inside message_data
            md = photo_input.get("message_data")
            if isinstance(md, dict):
                for key in ["photo_input", "photo", "image", "data_uri", "image_data"]:
                    if isinstance(md.get(key), str) and md[key].strip():
                        candidates.append(md[key].strip())
    
    # Also check other ports for backward compatibility
    for port_id, value in inputs.items():
        if port_id == "photo":
            continue  # Already checked above
        if isinstance(value, str) and value.strip():
            candidates.append(value.strip())
        elif isinstance(value, dict):
            # Prefer explicit keys often used by upstream nodes
            for key in ["photo_input", "photo", "image", "data_uri", "url", "image_data", "photo_data"]:
                if isinstance(value.get(key), str) and value[key].strip():
                    candidates.append(value[key].strip())
            # Look inside message_data
            md = value.get("message_data")
            if isinstance(md, dict):
                for key in ["photo_input", "photo", "image", "data_uri", "image_data"]:
                    if isinstance(md.get(key), str) and md[key].strip():
                        candidates.append(md[key].strip())

    for cand in candidates:
        # Data URI path
        if cand.startswith("data:") and ";base64," in cand:
            header, b64 = cand.split(",", 1)
            mime = header[5:].split(";")[0].lower()
            try:
                image_bytes = base64.b64decode(b64)
                return image_bytes, mime
            except Exception:
                continue
        # Plain base64 (best effort)
        try:
            image_bytes = base64.b64decode(cand)
            # Unknown mime; assume JPEG
            return image_bytes, "image/jpeg"
        except Exception:
            continue

    return None, None


def _extract_caption_text(inputs: Dict[str, Any]) -> Optional[str]:
    """
    Extract caption text from inputs.
    Check the caption port first, then look for common text fields.
    """
    # Check the caption port specifically first
    caption_input = inputs.get("caption")
    if caption_input:
        if isinstance(caption_input, str) and caption_input.strip():
            return caption_input.strip()
        elif isinstance(caption_input, dict):
            # Look for common text keys - PRIORITY 1: ai_response first, then input_text
            for key in ["ai_response", "input_text", "chat_input", "text", "caption", "message"]:
                if isinstance(caption_input.get(key), str) and caption_input[key].strip():
                    return caption_input[key].strip()
    
    # Also check other ports for backward compatibility
    for port_id, value in inputs.items():
        if port_id in ["photo", "caption"]:
            continue  # Already checked or is photo port
        if isinstance(value, str) and value.strip():
            return value.strip()
        elif isinstance(value, dict):
            # Check for text content - PRIORITY 1: ai_response first, then input_text
            for key in ["ai_response", "input_text", "chat_input", "text", "caption", "message"]:
                if isinstance(value.get(key), str) and value[key].strip():
                    return value[key].strip()

    return None


async def execute_telegram_send_photo(context: Dict[str, Any]) -> NodeExecutionResult:
    try:
        logger.info(f"🔍 FULL EXECUTION CONTEXT (send photo): { {k: (v if k!='inputs' else list(v.keys()) if isinstance(v, dict) else type(v)) for k,v in context.items()} }")
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

        # Extract photo payload
        image_bytes, mime = _extract_photo_payload(inputs)
        if not image_bytes:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No valid photo payload found in inputs. Provide a data URI or base64-encoded image.",
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )

        # Extract caption (optional)
        caption = _extract_caption_text(inputs)

        # Validate format is acceptable for Telegram (JPEG, PNG, GIF, BMP, WEBP, SVG)
        mime_lower = (mime or "").lower()
        supported_formats = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/bmp", "image/webp", "image/svg"]
        if not any(fmt in mime_lower for fmt in supported_formats):
            logger.warning(f"Unsupported image format: {mime_lower}, proceeding anyway")

        # Determine file extension based on mime type
        file_ext = "jpg"
        if "png" in mime_lower:
            file_ext = "png"
        elif "gif" in mime_lower:
            file_ext = "gif"
        elif "bmp" in mime_lower:
            file_ext = "bmp"
        elif "webp" in mime_lower:
            file_ext = "webp"
        elif "svg" in mime_lower:
            file_ext = "svg"

        # Telegram API endpoint for sending photo
        url = f"https://api.telegram.org/bot{access_token}/sendPhoto"

        # Files: name the file with appropriate extension
        file_mime = mime or "image/jpeg"
        files = {
            "photo": (f"photo.{file_ext}", io.BytesIO(image_bytes), file_mime),
        }

        # Prepare the payload
        payload = {
            "chat_id": chat_id,
        }
        
        # Add caption if provided
        if caption:
            payload["caption"] = caption
            parse_mode = settings.get("parse_mode") or "Markdown"
            payload["parse_mode"] = parse_mode

        logger.info(f"Sending photo to Telegram chat {chat_id}")
        if caption:
            logger.info(f"Caption: {caption[:100]}{'...' if len(caption) > 100 else ''}")
        
        response = requests.post(url, data=payload, files=files)

        if response.status_code == 200:
            result = response.json()
            timestamp = datetime.now(timezone.utc).isoformat()
            output_data = {
                "success": True,
                "chat_id": chat_id,
                "timestamp": timestamp,
                "caption": caption,
                "response": result,
            }
            logs = ["Photo sent successfully"]
            if caption:
                logs.append(f"Caption: {caption[:50]}{'...' if len(caption) > 50 else ''}")
            
            return NodeExecutionResult(
                outputs={"telegram_result": output_data},
                status="success",
                logs=logs,
            )
        else:
            error_message = f"Failed to send photo: {getattr(response, 'text', str(response))}"
            logger.error(error_message)
            return NodeExecutionResult(
                outputs={},
                status="error",
                error=error_message,
            )

    except Exception as e:
        logger.error(f"Error in telegram_send_photo: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Error sending Telegram photo: {str(e)}",
        )
