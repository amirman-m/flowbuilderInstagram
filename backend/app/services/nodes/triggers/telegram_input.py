import asyncio
import json
from typing import Dict, Any, Optional
from fastapi.responses import StreamingResponse
from ....models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from ...telegram_bot_service import TelegramBotService
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

# Global SSE connection registry
_sse_connections: Dict[int, Dict[str, asyncio.Queue]] = {}

async def notify_sse_connections(flow_id: int, event_data: Dict[str, Any]):
    """
    Notify all SSE connections for a specific flow with event data
    """
    connections = _sse_connections.get(flow_id, {})
    if not connections:
        logger.info(f" No SSE connections for flow {flow_id}")
        return
    
    logger.info(f"Notifying {len(connections)} SSE connections for flow {flow_id}")
    
    # Remove closed connections and notify active ones
    active_connections = {}
    for connection_id, queue in connections.items():
        try:
            await queue.put(event_data)
            active_connections[connection_id] = queue
        except Exception as e:
            logger.warning(f"Failed to notify SSE connection: {e}")
    
    # Update the registry with only active connections
    _sse_connections[flow_id] = active_connections

# Global message storage for SSE notifications
_pending_messages = {}

def get_telegram_input_node_type() -> NodeType:
    return NodeType(
        id="telegram_input",
        name="Telegram Input",
        description="Webhook receiver for Telegram bot updates (text and voice messages)",
        category=NodeCategory.TRIGGER,
        version="1.0.0",
        icon="telegram",
        color="#4CAF50",
        ports=NodePorts(
            inputs=[],  # Trigger nodes have no inputs
            outputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Contains chat_id, input_text, and message metadata from Telegram",
                    data_type=[NodeDataType.OBJECT , NodeDataType.STRING],
                    required=True
                )
            ]
        ),
        settings_schema={
            "type": "object",
            "properties": {},  # No settings
            "required": []
        }
    )

# Legacy function - replaced by TelegramBotService
async def setup_telegram_webhook(access_token: str, webhook_url: str) -> bool:
    """
    DEPRECATED: Use TelegramBotService instead
    """
    logger.warning("setup_telegram_webhook is deprecated. Use TelegramBotService instead.")
    return False

async def process_webhook_message(webhook_data: Dict[str, Any], access_token: str, flow_id: int = None, bot_id: Optional[str] = None) -> NodeExecutionResult:
    """
    Process incoming Telegram webhook message and extract data
    """
    try:
        # Parse Telegram update
        update = webhook_data
        message = update.get("message")
        
        if not message:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No message found in webhook data"
            )
        
        # Extract chat_id
        chat_id = message.get("chat", {}).get("id")
        if not chat_id:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No chat_id found in message"
            )
        
        # Create session ID
        session_id = str(uuid.uuid4())
        
        # Derive bot_id from explicit param or trigger_data in webhook_data
        effective_bot_id = bot_id or (update.get("trigger_data", {}) or {}).get("bot_id") or (update.get("trigger_data", {}) or {}).get("telegram_bot_id")
        if effective_bot_id:
            logger.info(f"telegram_input: using bot_id from webhook context: {effective_bot_id}")
        
        # Extract text from message
        text_content = message.get("text")
        
        if text_content:
            # For text messages - format for compatibility with OpenAI chat node
            message_data = {
                "session_id": session_id,
                "chat_id": chat_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {
                    "telegram_message_id": message.get("message_id"),
                    "from_user": message.get("from", {}).get("username", "unknown"),
                    "chat_type": message.get("chat", {}).get("type", "private"),
                    **({"bot_id": effective_bot_id, "telegram_bot_id": effective_bot_id} if effective_bot_id else {})
                },
                "input_text": text_content,  # OpenAI node expects 'input_text'
                "chat_input": text_content,  # Keep original for backward compatibility
                "input_type": "text",
                **({"bot_id": effective_bot_id, "telegram_bot_id": effective_bot_id} if effective_bot_id else {})
            }
            log_msg = f"Telegram text message from chat {chat_id}: \"{text_content[:50]}{'...' if len(text_content) > 50 else ''}\""
            
        # Check for voice message
        elif "voice" in message:
            voice_info = message["voice"]
            message_data = {
                "session_id": session_id,
                "chat_id": chat_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {
                    "telegram_message_id": message.get("message_id"),
                    "from_user": message.get("from", {}).get("username", "unknown"),
                    "chat_type": message.get("chat", {}).get("type", "private"),
                    **({"bot_id": effective_bot_id, "telegram_bot_id": effective_bot_id} if effective_bot_id else {})
                },
                "voice_input": {
                    "file_id": voice_info.get("file_id"),
                    "file_unique_id": voice_info.get("file_unique_id"),
                    "duration": voice_info.get("duration"),
                    "mime_type": voice_info.get("mime_type"),
                    "file_size": voice_info.get("file_size")
                },
                "input_type": "voice",
                **({"bot_id": effective_bot_id, "telegram_bot_id": effective_bot_id} if effective_bot_id else {})
            }
            log_msg = f"Telegram voice message from chat {chat_id}: {voice_info.get('duration', 0)}s"
        
        # Check for photo message (array of sizes)
        elif "photo" in message:
            photos = message.get("photo", []) or []
            # Choose the largest photo by area (width*height); Telegram ensures ascending size order,
            # but we compute robustly in case of inconsistencies
            best_photo = None
            if photos:
                best_photo = max(
                    photos,
                    key=lambda p: (p.get("width", 0) or 0) * (p.get("height", 0) or 0)
                )
            caption = message.get("caption")
            message_data = {
                "session_id": session_id,
                "chat_id": chat_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {
                    "telegram_message_id": message.get("message_id"),
                    "from_user": message.get("from", {}).get("username", "unknown"),
                    "chat_type": message.get("chat", {}).get("type", "private"),
                    **({"bot_id": effective_bot_id, "telegram_bot_id": effective_bot_id} if effective_bot_id else {})
                },
                # Provide both the selected best photo and the full list for downstream use
                "photo_input": {
                    "best": best_photo,
                    "all": photos,
                },
                # If a caption exists, also surface it as input_text/chat_input for compatibility
                **({
                    "input_text": caption,
                    "chat_input": caption,
                } if caption else {}),
                "input_type": "photo",
                **({"bot_id": effective_bot_id, "telegram_bot_id": effective_bot_id} if effective_bot_id else {})
            }
            preview = f" with caption: \"{caption[:40]}...\"" if caption and len(caption) > 40 else (f" with caption: \"{caption}\"" if caption else "")
            dims = f"{(best_photo or {}).get('width', '?')}x{(best_photo or {}).get('height', '?')}"
            log_msg = f"Telegram photo message from chat {chat_id}: best={dims}{preview}"
        
        else:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Unsupported message type (only text, voice, and photo are supported)"
            )
        
        # Notify SSE connections if flow_id provided
        if flow_id:
            await notify_sse_connections(flow_id, {
                "type": "telegram_message",
                "status": "success",
                "outputs": {"message_data": message_data},
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        # Return the result
        return NodeExecutionResult(
            outputs={"message_data": message_data},
            status="success",
            logs=[log_msg],
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
        
    except Exception as e:
        logger.error(f"Error processing Telegram webhook: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Failed to process webhook data: {str(e)}"
        )

async def register_sse_connection(flow_id: int, connection_id: str, queue: asyncio.Queue):
    """Register a new SSE connection for a flow"""
    if flow_id not in _sse_connections:
        _sse_connections[flow_id] = {}
    _sse_connections[flow_id][connection_id] = queue
    logger.info(f"Registered SSE connection {connection_id} for flow {flow_id}")

async def unregister_sse_connection(flow_id: int, connection_id: str):
    """Unregister an SSE connection"""
    if flow_id in _sse_connections and connection_id in _sse_connections[flow_id]:
        del _sse_connections[flow_id][connection_id]
        if not _sse_connections[flow_id]:  # Remove empty flow entry
            del _sse_connections[flow_id]
        logger.info(f"Unregistered SSE connection {connection_id} for flow {flow_id}")

async def execute_telegram_input_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute Telegram input trigger node using new modular TelegramBotService
    
    Execution Contexts:
    1) Webhook data processing (called from webhook endpoint) -> process and emit via SSE
    2) Node test execution (from UI): setup webhook, listen for ONE message for testing
    3) Flow test execution: setup webhook, listen for ONE message for flow testing
    4) 24/7 activation: continuous processing (controlled by flow.status)
    """
    start_time = datetime.now(timezone.utc)
    
    # Get context
    settings = context.get("settings", {})
    access_token = context.get("access_token") or settings.get("access_token")
    config_name = context.get("config_name") or settings.get("config_name")
    flow_id = context.get("flow_id", 1)
    node_id = context.get("node_id", "telegram_input")
    user_id = context.get("user_id", 1)  # TODO: use auth context
    
    # Determine execution context
    is_webhook_processing = bool(context.get("webhook_data"))
    is_flow_execution = bool(context.get("is_flow_execution"))  # Set by flow executor
    is_node_test = not is_webhook_processing and not is_flow_execution  # Individual node testing
    
    # Set execution mode based on context
    if is_webhook_processing:
        execution_mode = "webhook_processing"
    elif is_flow_execution:
        execution_mode = "flow_test"  # Flow testing - single webhook
    else:
        execution_mode = "node_test"  # Node testing - single webhook
    
    logger.info(f"Telegram node execution - flow {flow_id}, node {node_id}, mode: {execution_mode}")
    
    # Webhook processing path
    webhook_data = context.get("webhook_data")
    if webhook_data:
        logger.info("Processing webhook data for flow execution")
        # Preserve bot_id from the execution context trigger_data (sibling of webhook_data)
        ctx_trigger = (context.get("trigger_data", {}) or {}) if isinstance(context, dict) else {}
        _bot_id = ctx_trigger.get("bot_id") or ctx_trigger.get("telegram_bot_id")
        if not _bot_id and isinstance(webhook_data, dict):
            td = (webhook_data.get("trigger_data", {}) or {})
            _bot_id = td.get("bot_id") or td.get("telegram_bot_id")
        return await process_webhook_message(webhook_data, access_token or "", flow_id, bot_id=_bot_id)
    
    # Node/Flow testing execution: always allowed regardless of flow activation status
    try:
        bot_service = TelegramBotService()
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            # If neither access token nor config name given, instruct UI
            if not (access_token or (config_name and str(config_name).strip())):
                return NodeExecutionResult(
                    outputs={
                        "webhook_status": "pending_setup",
                        "message": "Provide a saved bot name (config_name) or configure one in settings.",
                        "execution_mode": execution_mode
                    },
                    status="success",
                    started_at=start_time,
                    completed_at=datetime.now(timezone.utc)
                )
            
            # If config_name provided, verify existence and readiness
            if (config_name and str(config_name).strip()):
                configs = bot_service.list_user_configs(db, user_id)
                match = next((c for c in configs if c.get("config_name") == config_name), None)
                if not match:
                    return NodeExecutionResult(
                        outputs={},
                        status="error",
                        error=f"No bot config found named '{config_name}'",
                        started_at=start_time,
                        completed_at=datetime.now(timezone.utc)
                    )
                webhook_url = match.get("webhook_url")
                if not webhook_url:
                    return NodeExecutionResult(
                        outputs={},
                        status="error",
                        error="Bot config exists but webhook is not configured",
                        started_at=start_time,
                        completed_at=datetime.now(timezone.utc)
                    )
                
                # Return ready status for testing (regardless of flow activation)
                test_message = "individual node" if execution_mode == "node_test" else "flow"
                return NodeExecutionResult(
                    outputs={
                        "webhook_status": "configured",
                        "bot_config": {
                            "config_name": match.get("config_name"),
                            "bot_username": match.get("bot_username"),
                            "bot_id": match.get("bot_id"),
                            "webhook_url": webhook_url,
                        },
                        "message": f"Telegram bot configured. Ready for {test_message} testing - listening for single message.",
                        "execution_mode": execution_mode,
                        "is_test_mode": True
                    },
                    status="success",
                    started_at=start_time,
                    completed_at=datetime.now(timezone.utc)
                )
            
            # Fallback: if only access_token present, setup bot config
            success, message, config_data = await bot_service.validate_and_setup_bot(
                db=db,
                user_id=user_id,
                access_token=access_token,
                flow_id=flow_id,
                node_id=node_id,
            )
            if not success:
                return NodeExecutionResult(
                    outputs={},
                    status="error",
                    error=message,
                    started_at=start_time,
                    completed_at=datetime.now(timezone.utc)
                )
            
            test_message = "individual node" if execution_mode == "node_test" else "flow"
            return NodeExecutionResult(
                outputs={
                    "webhook_status": "configured",
                    "bot_config": config_data,
                    "message": f"Bot configured successfully. Ready for {test_message} testing - listening for single message.",
                    "execution_mode": execution_mode,
                    "is_test_mode": True
                },
                status="success",
                started_at=start_time,
                completed_at=datetime.now(timezone.utc)
            )
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error in Telegram execution: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Failed to execute Telegram node: {str(e)}",
            started_at=start_time,
            completed_at=datetime.now(timezone.utc)
        )

async def create_telegram_sse_stream(context: Dict[str, Any]) -> StreamingResponse:
    """
    Create SSE stream for Telegram input.
    No webhook setup here; assumes webhook already configured at the stable URL.
    """
    flow_id = context.get("flow_id", 1)
    logger.info(f"Starting SSE stream for flow {flow_id}")

    async def sse_stream():
        connection_id = str(uuid.uuid4())
        message_queue = asyncio.Queue()
        
        try:
            # Register this SSE connection
            await register_sse_connection(flow_id, connection_id, message_queue)
            
            # Send initial webhook ready event
            yield f"data: {json.dumps({'type': 'webhook_ready', 'message': 'Webhook active - waiting for Telegram message...'})}\n\n"
            
            # Wait loop with keepalive pings
            timeout_seconds = 60
            start_time_ts = datetime.now(timezone.utc)
            
            while True:
                try:
                    remaining_time = timeout_seconds - (datetime.now(timezone.utc) - start_time_ts).total_seconds()
                    if remaining_time <= 0:
                        yield f"data: {json.dumps({'type': 'timeout', 'message': f'Timeout: No message received in {timeout_seconds} seconds'})}\n\n"
                        break
                    
                    try:
                        message = await asyncio.wait_for(message_queue.get(), timeout=min(remaining_time, 5.0))
                        yield f"data: {json.dumps(message)}\n\n"
                        if message.get('type') == 'telegram_message':
                            break
                    except asyncio.TimeoutError:
                        yield f"data: {json.dumps({'type': 'ping', 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
                        continue
                except Exception as e:
                    logger.error(f"Error in SSE stream: {e}")
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Stream error: {str(e)}'})}\n\n"
                    break
        except Exception as e:
            logger.error(f"Error setting up SSE stream: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': f'Setup error: {str(e)}'})}\n\n"
        finally:
            await unregister_sse_connection(flow_id, connection_id)
            logger.info(f"SSE stream ended for connection {connection_id}")
    
    return StreamingResponse(sse_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true"
    })
