import os
import asyncio
import httpx
from typing import Dict, Any, Optional
from ....models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
import uuid
import logging
import threading
import queue
import time

logger = logging.getLogger(__name__)

# Global state to track webhook registrations and message queues
_webhook_states = {}
_message_queues = {}  # Store message queues for waiting executions

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
                    logger.error(f"Telegram API error: {result.get('description', 'Unknown error')}")
                    return False
            else:
                logger.error(f"Failed to set up webhook: HTTP {response.status_code}")
                return False
                
    except Exception as e:
        logger.error(f"Error setting up Telegram webhook: {str(e)}")
        return False

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

async def execute_telegram_input_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute Telegram input trigger node
    This sets up webhook, waits for message, extracts data, and returns synchronously
    """
    
    # Get settings from context
    settings = context.get("settings", {})
    access_token = settings.get("access_token")
    
    if not access_token:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="Bot access token not configured"
        )
    
    # Check if this is webhook data processing (called from webhook endpoint)
    webhook_data = context.get("webhook_data")
    if webhook_data:
        # This is webhook data processing - extract and return immediately
        return await process_webhook_message(webhook_data, access_token)
    
    # This is direct execution - set up webhook and wait for message
    try:
        node_id = context.get("nodeId", "unknown")
        execution_id = str(uuid.uuid4())
        
        # Create message queue for this execution
        message_queue = queue.Queue(maxsize=1)
        _message_queues[execution_id] = message_queue
        
        # Set up webhook with execution_id in URL
        webhook_url = f"https://asangram.tech/api/v1/telegram/webhook/1?execution_id={execution_id}"
        
        logger.info(f"Setting up Telegram webhook for execution {execution_id}")
        webhook_success = await setup_telegram_webhook(access_token, webhook_url)
        
        if not webhook_success:
            # Clean up queue
            _message_queues.pop(execution_id, None)
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Failed to set up Telegram webhook"
            )
        
        logger.info(f"Webhook set up successfully, waiting for message (execution: {execution_id})")
        
        # Wait for message with timeout (60 seconds)
        timeout = 60
        start_time = time.time()
        
        try:
            # Wait for message to arrive in queue
            message_data = message_queue.get(timeout=timeout)
            
            # Clean up queue
            _message_queues.pop(execution_id, None)
            
            logger.info(f"Message received for execution {execution_id}: {message_data}")
            
            # Extract text for logging
            input_text = message_data.get('input_text') or message_data.get('chat_input', 'N/A')
            chat_id = message_data.get('chat_id', 'N/A')
            
            return NodeExecutionResult(
                outputs={"message_data": message_data},
                status="success",
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
                logs=[f"Telegram message received from chat {chat_id}: '{input_text}'"]
            )
            
        except queue.Empty:
            # Timeout - no message received
            _message_queues.pop(execution_id, None)
            logger.warning(f"Timeout waiting for Telegram message (execution: {execution_id})")
            
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Timeout waiting for Telegram message (60 seconds)"
            )
                
    except Exception as e:
        # Clean up queue on error
        _message_queues.pop(execution_id, None)
        logger.error(f"Error in Telegram execution: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Failed to execute Telegram node: {str(e)}"
        )
