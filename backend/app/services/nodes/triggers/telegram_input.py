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
import threading
import os
import json
import asyncio

logger = logging.getLogger(__name__)

# Global state to track webhook registrations and message queues
_webhook_states = {}
_message_queues = {}  # Store message queues for waiting executions
_queue_lock = threading.Lock()  # Thread safety for queue operations

# File-based queue tracking for multi-process coordination
QUEUE_TRACKING_FILE = "/tmp/telegram_queues.json"

def _save_queue_state():
    """Save current queue state to file for multi-process coordination"""
    try:
        with _queue_lock:
            queue_info = {exec_id: True for exec_id in _message_queues.keys()}
            with open(QUEUE_TRACKING_FILE, 'w') as f:
                json.dump(queue_info, f)
    except Exception as e:
        logger.error(f"Failed to save queue state: {e}")

def _load_queue_state():
    """Load queue state from file and recreate missing queues"""
    try:
        if os.path.exists(QUEUE_TRACKING_FILE):
            with open(QUEUE_TRACKING_FILE, 'r') as f:
                queue_info = json.load(f)
            
            with _queue_lock:
                for exec_id in queue_info.keys():
                    if exec_id not in _message_queues:
                        _message_queues[exec_id] = queue.Queue(maxsize=1)
                        logger.info(f"Recreated queue for execution_id {exec_id}")
    except Exception as e:
        logger.error(f"Failed to load queue state: {e}")

# Database-based message storage for multi-process coordination
TELEGRAM_MESSAGES_TABLE = "telegram_execution_messages"

async def _store_message_in_db(execution_id: str, message_data: dict):
    """Store Telegram message data in database for cross-process access"""
    try:
        from ...core.database import get_db
        from sqlalchemy import text
        
        # Get database session
        db = next(get_db())
        
        # Create table if it doesn't exist
        create_table_sql = f"""
        CREATE TABLE IF NOT EXISTS {TELEGRAM_MESSAGES_TABLE} (
            execution_id VARCHAR(255) PRIMARY KEY,
            message_data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        db.execute(text(create_table_sql))
        
        # Store message data
        insert_sql = f"""
        INSERT INTO {TELEGRAM_MESSAGES_TABLE} (execution_id, message_data)
        VALUES (:execution_id, :message_data)
        ON CONFLICT (execution_id) DO UPDATE SET
            message_data = EXCLUDED.message_data,
            created_at = CURRENT_TIMESTAMP
        """
        
        db.execute(text(insert_sql), {
            "execution_id": execution_id,
            "message_data": json.dumps(message_data)
        })
        db.commit()
        
        logger.info(f"Stored message data in database for execution {execution_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to store message in database: {str(e)}")
        return False
    finally:
        if 'db' in locals():
            db.close()

async def _get_message_from_db(execution_id: str) -> dict:
    """Retrieve Telegram message data from database"""
    try:
        from ...core.database import get_db
        from sqlalchemy import text
        
        # Get database session
        db = next(get_db())
        
        # Query for message data
        query_sql = f"""
        SELECT message_data FROM {TELEGRAM_MESSAGES_TABLE}
        WHERE execution_id = :execution_id
        """
        
        result = db.execute(text(query_sql), {"execution_id": execution_id})
        row = result.fetchone()
        
        if row:
            message_data = json.loads(row[0])
            logger.info(f"Retrieved message data from database for execution {execution_id}")
            return message_data
        
        return None
        
    except Exception as e:
        logger.error(f"Failed to get message from database: {str(e)}")
        return None
    finally:
        if 'db' in locals():
            db.close()

async def _cleanup_message_from_db(execution_id: str):
    """Clean up message data from database after processing"""
    try:
        from ...core.database import get_db
        from sqlalchemy import text
        
        # Get database session
        db = next(get_db())
        
        # Delete message data
        delete_sql = f"""
        DELETE FROM {TELEGRAM_MESSAGES_TABLE}
        WHERE execution_id = :execution_id
        """
        
        db.execute(text(delete_sql), {"execution_id": execution_id})
        db.commit()
        
        logger.info(f"Cleaned up message data from database for execution {execution_id}")
        
    except Exception as e:
        logger.error(f"Failed to cleanup message from database: {str(e)}")
    finally:
        if 'db' in locals():
            db.close()

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

async def setup_telegram_webhook_for_execution(access_token: str, flow_id: int) -> Dict[str, Any]:
    """
    Step 1: Set up Telegram webhook for execution with unique execution_id
    """
    try:
        # Generate unique execution ID
        execution_id = str(uuid.uuid4())
        
        # Create message queue for this execution
        message_queue = queue.Queue(maxsize=1)
        _message_queues[execution_id] = message_queue
        
        logger.info(f"Created message queue for execution {execution_id}. Total queues: {len(_message_queues)}")
        
        # Set up webhook with execution_id in URL
        webhook_url = f"https://asangram.tech/api/v1/telegram/webhook/{flow_id}?execution_id={execution_id}"
        
        # Set up the webhook
        webhook_success = await setup_telegram_webhook(access_token, webhook_url)
        
        if webhook_success:
            logger.info(f"Webhook set up successfully for execution {execution_id}: {webhook_url}")
            return {
                "success": True,
                "execution_id": execution_id,
                "webhook_url": webhook_url
            }
        else:
            # Clean up queue on failure
            _message_queues.pop(execution_id, None)
            return {
                "success": False,
                "error": "Failed to set up Telegram webhook"
            }
            
    except Exception as e:
        logger.error(f"Error setting up webhook for execution: {str(e)}")
        return {
            "success": False,
            "error": f"Webhook setup failed: {str(e)}"
        }

async def wait_for_telegram_message(execution_id: str, timeout: int = 30) -> Dict[str, Any]:
    """
    Step 2: Wait for Telegram message using database polling (multi-process safe)
    """
    try:
        start_time = time.time()
        logger.info(f"Waiting for message (execution: {execution_id}, timeout: {timeout}s)")
        
        # Poll database for message data instead of using in-memory queue
        poll_interval = 0.5  # Check every 500ms
        max_polls = int(timeout / poll_interval)
        
        for poll_count in range(max_polls):
            # Check if message has been stored in database
            message_data = await _get_message_from_db(execution_id)
            
            if message_data:
                # Message found! Clean up and return
                await _cleanup_message_from_db(execution_id)
                
                execution_time = time.time() - start_time
                
                # Extract text for logging
                input_text = message_data.get('input_text') or message_data.get('chat_input', 'N/A')
                chat_id = message_data.get('chat_id', 'N/A')
                
                logger.info(f"Message received for execution {execution_id}: chat {chat_id}, text: '{input_text}' (after {execution_time:.1f}s)")
                
                return {
                    "success": True,
                    "message_data": message_data,
                    "logs": [f"Telegram message received from chat {chat_id}: '{input_text}'"],
                    "execution_time": execution_time
                }
            
            # Wait before next poll
            await asyncio.sleep(poll_interval)
        
        # Timeout reached
        logger.warning(f"Timeout waiting for Telegram message (execution: {execution_id})")
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
        
        # Create execution ID and message queue for synchronous waiting
        # Create message queue for this execution
        with _queue_lock:
            message_queue = queue.Queue(maxsize=1)
            _message_queues[execution_id] = message_queue
            _save_queue_state()
        
        logger.info(f"Created message queue for execution {execution_id}. Total queues: {len(_message_queues)}")
        logger.info(f"Current queue keys: {list(_message_queues.keys())}")
        
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
