import os
import asyncio
import httpx
from typing import Dict, Any, Optional
from ....models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

# Global state to track webhook registrations
_webhook_states = {}

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
                    description="Contains chat_id and either chat_input or voice_input",
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

async def execute_telegram_input_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute Telegram input trigger node
    This node processes incoming Telegram webhook updates
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
    
    # Get webhook data from context (this will be provided by the webhook endpoint)
    webhook_data = context.get("webhook_data")
    
    if not webhook_data:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="No webhook data provided"
        )
    
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
        
        # Check for text message
        if "text" in message:
            message_data["chat_input"] = message["text"]
            message_data["input_type"] = "message"
            log_msg = f"Telegram text message from chat {chat_id}: \"{message['text'][:50]}{'...' if len(message['text']) > 50 else ''}\""
            
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
