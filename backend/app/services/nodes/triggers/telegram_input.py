import os
import asyncio
import httpx
from typing import Dict, Any, Optional
from ....models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

# Global state to track webhook registrations (simplified)
_webhook_states = {}

# Simplified approach - no complex queue management needed

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
            "properties": {
                "access_token": {
                    "type": "string",
                    "title": "Bot Access Token",
                    "description": "Telegram Bot API access token (from @BotFather)",
                    "minLength": 1
                }
            },
            "required": ["access_token"]
        }
    )

async def setup_telegram_webhook(access_token: str, webhook_url: str) -> bool:
    """
    Set up Telegram webhook for the bot
    Returns True if successful, False otherwise
    """
    try:
        # Check if webhook is already set up for this token
        webhook_key = f"telegram_webhook_{access_token[:10]}"
        if _webhook_states.get(webhook_key):
            logger.info(f"Webhook already configured for token {access_token[:10]}...")
            return True

        # Set up the webhook
        telegram_api_url = f"https://api.telegram.org/bot{access_token}/setWebhook"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                telegram_api_url,
                json={
                    "url": webhook_url,
                    "allowed_updates": ["message"]
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("ok"):
                    _webhook_states[webhook_key] = True
                    logger.info(f"Telegram webhook set up successfully for {webhook_url}")
                    return True
                else:
                    error_desc = result.get('description', 'Unknown error')
                    logger.error(f"Telegram API error: {error_desc}")
                    logger.error(f"Full Telegram response: {result}")
                    return False
            else:
                # Try to get error details from response body
                try:
                    error_result = response.json()
                    error_desc = error_result.get('description', 'No description provided')
                    logger.error(f"Failed to set up webhook: HTTP {response.status_code} - {error_desc}")
                    logger.error(f"Full error response: {error_result}")
                except:
                    logger.error(f"Failed to set up webhook: HTTP {response.status_code}")
                    logger.error(f"Response text: {response.text}")
                
                logger.error(f"Webhook URL attempted: {webhook_url}")
                return False
                
    except Exception as e:
        logger.error(f"Error setting up Telegram webhook: {str(e)}")
        return False

        await _cleanup_message_from_db(execution_id)  # Clean up any pending state
        
        return {
            "success": False,
            "timeout": True,
            "error": f"Timeout waiting for Telegram message ({timeout} seconds)"
        }
                
    except Exception as e:
        logger.error(f"Error waiting for message: {str(e)}")
        await _cleanup_message_from_db(execution_id)  # Clean up on error
        return {
            "success": False,
            "error": f"Failed to wait for message: {str(e)}"
        }

async def process_webhook_message(webhook_data: Dict[str, Any], access_token: str) -> NodeExecutionResult:
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
        
        # Determine message type and extract content
        message_data = {
            "session_id": session_id,
            "chat_id": chat_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "telegram_message_id": message.get("message_id"),
                "from_user": message.get("from", {}).get("username", "unknown"),
                "chat_type": message.get("chat", {}).get("type", "private")
            }
        }
        
        # Extract text from message
        text_content = message.get("text")
        
        if text_content:
            # For text messages - format for compatibility with OpenAI chat node
            message_data["input_text"] = text_content  # OpenAI node expects 'input_text'
            message_data["chat_input"] = text_content  # Keep original for backward compatibility
            message_data["input_type"] = "text"
            log_msg = f"Telegram text message from chat {chat_id}: \"{text_content[:50]}{'...' if len(text_content) > 50 else ''}\""
            
        # Check for voice message
        elif "voice" in message:
            voice_info = message["voice"]
            message_data["voice_input"] = {
                "file_id": voice_info.get("file_id"),
                "file_unique_id": voice_info.get("file_unique_id"),
                "duration": voice_info.get("duration"),
                "mime_type": voice_info.get("mime_type"),
                "file_size": voice_info.get("file_size")
            }
            message_data["input_type"] = "voice"
            log_msg = f"Telegram voice message from chat {chat_id}: {voice_info.get('duration', 0)}s"
            
        else:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Unsupported message type (only text and voice are supported)"
            )
        
        # Return the processed message data
        return NodeExecutionResult(
            outputs={"message_data": message_data},
            status="success",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            logs=[log_msg]
        )
        
    except Exception as e:
        logger.error(f"Error processing Telegram webhook: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Failed to process webhook data: {str(e)}"
        )

# Global queue to store messages for waiting executions
_message_queue = {}
_queue_lock = asyncio.Lock()

async def execute_telegram_input_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute Telegram input trigger node - SINGLE PROCESS like DeepSeek
    
    This function works in two modes:
    1. Direct execution (from frontend) - Sets up webhook and WAITS for message
    2. Webhook processing (from webhook endpoint) - Processes and stores message data
    """
    
    # Get settings from context
    settings = context.get("settings", {})
    access_token = settings.get("access_token") or context.get("access_token")
    
    # Debug logging to see what's in context
    logger.info(f"Context keys: {list(context.keys())}")
    logger.info(f"Settings: {settings}")
    logger.info(f"Access token from settings: {settings.get('access_token')}")
    logger.info(f"Access token from context: {context.get('access_token')}")
    logger.info(f"Final access token: {access_token}")
    
    if not access_token:
        logger.error(f"No access token found. Context: {context}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="Bot access token not configured",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
    
    # Check if this is webhook data processing (called from webhook endpoint)
    webhook_data = context.get("webhook_data")
    if webhook_data:
        # This is webhook data processing - store message and notify waiting execution
        logger.info("Processing webhook data and notifying waiting execution")
        result = await process_webhook_message(webhook_data, access_token)
        
        if result.status == "success":
            # Store message data for waiting execution
            async with _queue_lock:
                _message_queue["latest_message"] = result
            logger.info("Message stored for waiting execution")
        
        return result
    
    # This is direct execution from frontend - set up webhook and WAIT for message
    try:
        flow_id = context.get("flow_id", 1)
        node_id = context.get("node_id", "telegram_input")
        
        # Set up webhook for this flow
        webhook_url = f"https://asangram.tech/api/v1/telegram/webhook/{flow_id}"
        
        logger.info(f"Setting up Telegram webhook for flow {flow_id}")
        webhook_success = await setup_telegram_webhook(access_token, webhook_url)
        
        if not webhook_success:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Failed to set up Telegram webhook",
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc)
            )
        
        logger.info(f"Webhook set up successfully, now waiting for message...")
        
        # WAIT for message (like DeepSeek waits for API response)
        start_time = datetime.now(timezone.utc)
        timeout_seconds = 60  # Wait up to 60 seconds
        
        while True:
            # Check if we have a message
            async with _queue_lock:
                if "latest_message" in _message_queue:
                    message_result = _message_queue.pop("latest_message")
                    logger.info("Found message! Returning to frontend.")
                    return message_result
            
            # Check timeout
            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
            if elapsed > timeout_seconds:
                logger.warning(f"Timeout waiting for Telegram message ({timeout_seconds}s)")
                return NodeExecutionResult(
                    outputs={},
                    status="error",
                    error=f"Timeout: No message received in {timeout_seconds} seconds",
                    started_at=start_time,
                    completed_at=datetime.now(timezone.utc)
                )
            
            # Wait a bit before checking again
            await asyncio.sleep(0.5)
                
    except Exception as e:
        logger.error(f"Error in Telegram execution: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Failed to execute Telegram node: {str(e)}",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
