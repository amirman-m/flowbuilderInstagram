import os
import asyncio
import httpx
import json
import requests
from typing import Dict, Any, Optional
from fastapi.responses import StreamingResponse
from ....models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
import uuid
import logging
import traceback
logger = logging.getLogger(__name__)

def get_telegram_output_message_node_type() -> NodeType:
    return NodeType(
        id="send_telegram_message",
        name="Send Telegram Message",
        description="Send message to Telegram bot",
        category=NodeCategory.ACTION,
        version="1.0.0",
        icon="telegram",
        color="#4CAF50",
        ports=NodePorts(
            inputs=[NodePort(
                    id="message_text",
                    name="message_text",
                    label="Message Text",
                    description="Contains string text to send message to telegram bot",
                    data_type=[NodeDataType.STRING],
                    required=True
                )],
            outputs=[]
        ),
        settings_schema={
            "type": "object",
            "properties": {
                "access_token": {
                    "type": "string",
                    "title": "Bot Access Token",
                    "description": "Telegram Bot API access token (from @BotFather)",
                    "minLength": 1
                },
                "chat_id": {
                    "type": "string",
                    "title": "Chat ID",
                    "description": "Telegram Chat ID to send messages to (optional if connected to Telegram Input node)",
                }
            },
            "required": []
        }
    )
async def execute_telegram_output_message(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute Telegram output message node
    This node sends a message to a Telegram chat using the Telegram Bot API.
    
    It can get the message text from:
    - input_text field in connected node output
    - ai_response field in connected node output
    - direct string input
    
    It can get access_token and chat_id from:
    - Node settings
    - Connected Telegram Input node
    - Upstream Telegram Input node (through flow traversal)
    """
    try:
        # Debug: Log the entire context to see what we're receiving
        logger.info(f"🔍 FULL EXECUTION CONTEXT: {context}")
        
        # Get settings and inputs
        settings = context.get("settings", {})
        inputs = context.get("inputs", {})
        node_id = context.get("node_id", "unknown")
        
        # Extract flow_id from context (handle both flowId from frontend and flow_id)
        flow_id = context.get("flow_id") or context.get("flowId")
        
        # Debug: Log each key separately
        logger.info(f" Context keys: {list(context.keys())}")
        logger.info(f" flow_id from context.get('flow_id'): {context.get('flow_id')}")
        logger.info(f" flowId from context.get('flowId'): {context.get('flowId')}")
        logger.info(f" Final flow_id value: {flow_id}")
        
        logger.info(f"Executing Telegram output message node {node_id}")
        logger.info(f"Inputs: {inputs}")
        logger.info(f"Settings: {settings}")
        
        # Find the first string input from any connected node
        # Extract message text from inputs
        message = None
        input_source = None
        for port_id, port_data in inputs.items():
            if isinstance(port_data, str) and port_data.strip():
                message = port_data.strip()
                input_source = port_id
                logger.info(f"Found message text from direct string input: {message[:50]}...")
                break
            elif isinstance(port_data, dict):
                # PRIORITY 1: Check for ai_response first 
                if "ai_response" in port_data and isinstance(port_data["ai_response"], str):
                    message = port_data["ai_response"].strip()
                    input_source = f"{port_id}.ai_response"
                    # Extract additional metadata if available
                    session_id = port_data.get("session_id")
                    input_type = port_data.get("input_type", "text")
                    logger.info(f"Found message text from ai_response: {message[:50]}...")
                    break
                # PRIORITY 2: Check for input_text (backward compatibility and direct input)
                elif "input_text" in port_data and isinstance(port_data["input_text"], str):
                    message = port_data["input_text"].strip()
                    input_source = f"{port_id}.input_text"
                    # Extract additional metadata if available
                    session_id = port_data.get("session_id")
                    input_type = port_data.get("input_type", "text")
                    logger.info(f"Found message text from input_text: {message[:50]}...")
                    break
                # Priority 3: Check for chat_input (from older nodes)
                elif "chat_input" in port_data:
                    message = port_data["chat_input"].strip()
                    logger.info(f"Found message text from chat_input: {message[:50]}...")
                    break
                # PRIORITY 3: Check for any other string value in the dict
                else:
                    for key, value in port_data.items():
                        if isinstance(value, str) and value.strip():
                            message = value.strip()
                            input_source = f"{port_id}.{key}"
                            break
                if message:
                    break
            
        if not message:
                return NodeExecutionResult(
                    outputs={},
                    status="error",
                    error="No valid message text found in inputs"
                )
        
        # Get access_token and chat_id
        access_token = settings.get("access_token")
        chat_id = settings.get("chat_id")
        
        # If access_token or chat_id not in settings, try to find them in connected nodes
        if not access_token or not chat_id:
            logger.info(f"Searching for chat_id and access_token in inputs: {list(inputs.keys())}")
            
            # Look for telegram credentials in the inputs
            for port_id, port_data in inputs.items():
                logger.info(f"Checking port {port_id} with data type: {type(port_data)}")
                
                if isinstance(port_data, dict):
                    # Log the structure for debugging
                    logger.info(f"Port {port_id} data keys: {list(port_data.keys())}")
                    
                    # Check if this is output from a telegram_input node (direct chat_id)
                    if "chat_id" in port_data:
                        chat_id = port_data["chat_id"]
                        logger.info(f"Found chat_id from connected node: {chat_id}")
                    
                    # Check if there's access_token at top level
                    if "access_token" in port_data:
                        access_token = port_data["access_token"]
                        logger.info(f"Found access_token from connected node")
                    
                    # Check session_id to find matching Telegram session data
                    if "session_id" in port_data:
                        session_id = port_data["session_id"]
                        logger.info(f"Found session_id: {session_id}, searching for matching Telegram data")
                        
                        # If we have a session_id, search through all flow nodes for matching Telegram data
                        if flow_id and session_id:
                            try:
                                from sqlalchemy.orm import Session
                                from ....core.database import get_db
                                from ....models.node_instance import NodeInstance
                                db = next(get_db())
                                
                                # Query for telegram_input nodes in this flow
                                telegram_nodes = db.query(NodeInstance).filter(
                                    NodeInstance.flow_id == flow_id,
                                    NodeInstance.type_id == "telegram_input"
                                ).all()
                                
                                for tg_node in telegram_nodes:
                                    node_data = tg_node.data
                                    if isinstance(node_data, dict):
                                        # Check lastExecution for matching session_id
                                        last_exec = node_data.get("lastExecution", {})
                                        if isinstance(last_exec, dict):
                                            outputs = last_exec.get("outputs", {})
                                            message_data = outputs.get("message_data", {})
                                            
                                            if isinstance(message_data, dict) and message_data.get("session_id") == session_id:
                                                if not chat_id and "chat_id" in message_data:
                                                    chat_id = message_data["chat_id"]
                                                    logger.info(f"Found matching chat_id from Telegram node session: {chat_id}")
                                                
                                        # Check settings for access_token
                                        if not access_token:
                                            settings_data = node_data.get("settings", {})
                                            if "access_token" in settings_data:
                                                access_token = settings_data["access_token"]
                                                logger.info(f"Found access_token from Telegram node settings")
                                                
                                db.close()
                            except Exception as e:
                                logger.error(f"Error searching for Telegram session data: {e}")
                        
                    # Check if there's metadata with these values
                    if "metadata" in port_data and isinstance(port_data["metadata"], dict):
                        if not chat_id and "chat_id" in port_data["metadata"]:
                            chat_id = port_data["metadata"]["chat_id"]
                            logger.info(f"Found chat_id from metadata: {chat_id}")
                        
                        if not access_token and "access_token" in port_data["metadata"]:
                            access_token = port_data["metadata"]["access_token"]
                            logger.info(f"Found access_token from metadata")
                    
                    # Break if we found both
                    if chat_id and access_token:
                        break
                        
        # Final check - if we still don't have flow_id, that's the main issue
        if not flow_id:
            logger.error(f" CRITICAL: flow_id is None! Cannot proceed without flow_id.")
            logger.error(f" This means the frontend is not sending flowId or it's being lost in processing.")
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Missing flow_id in execution context. Please ensure the node is executed within a flow.",
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc)
            )
        
        # If we still don't have the credentials, fetch all nodes in the flow and find telegram_input node  
        if (not access_token or not chat_id) and flow_id:
            logger.info(f"Searching for Telegram input node in flow {flow_id}")
            try:
                # Make API request to get all nodes in the flow - use direct DB query
                from sqlalchemy.orm import Session
                from ....core.database import get_db
                from ....models.node_instance import NodeInstance
                db = next(get_db())
                
                # Query the database for nodes in this flow
                nodes = db.query(NodeInstance).filter(NodeInstance.flow_id == flow_id).all()
                logger.info(f"Found {len(nodes)} nodes in flow {flow_id}")
                # Find the telegram_input node
                for node in nodes:
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
                                        
                                if "chat_id" in message_data:
                                    chat_id = message_data["chat_id"]
                                    logger.info(f"Found chat_id in telegram_input lastExecution: {chat_id}")
                        
                        # If we found both, we can stop searching
                        if access_token and chat_id:
                            break
                
            except Exception as e:
                logger.error(f"Error fetching nodes from database: {e}")
                logger.error(f"Traceback: {traceback.format_exc()}")
                
        # Try to convert chat_id to integer if it's a string
        if chat_id and isinstance(chat_id, str):
            try:
                chat_id = int(chat_id)
                logger.info(f"Converted chat_id to integer: {chat_id}")
            except ValueError:
                # If it's not a valid integer, keep it as string
                pass

        # Check if we found the required credentials
        if not access_token:
            logger.error(" No Telegram access_token found. Please configure it in node settings or connect to a Telegram Input node.")
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No Telegram access_token found. Please configure it in node settings or connect to a Telegram Input node.",
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc)
            )
        
        if not chat_id:
            logger.error(" No Telegram chat_id found. Please configure it in node settings or connect to a Telegram Input node.")
            logger.error(f" Searched through inputs: {list(inputs.keys())}")
            logger.error(f" flow_id was: {flow_id}")
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No Telegram chat_id found. Please configure it in node settings or connect to a Telegram Input node.",
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc)
            )
        
        # Send message to Telegram
        url = f"https://api.telegram.org/bot{access_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "Markdown"  # Optional: Use "HTML" or "Markdown" for formatting
            }
            
        logger.info(f"Sending message to Telegram chat {chat_id}")
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            logger.info("✅ Successfully sent Telegram message to chat {chat_id}")
            logger.info(f"✅ Message: {message[:100]}...")
            result = response.json()
                
            # Create output data with metadata
            timestamp = datetime.now(timezone.utc).isoformat()
            output_data = {
                "success": True,
                "message_sent": message[:100] + ("..." if len(message) > 100 else ""),
                "chat_id": chat_id,
                "timestamp": timestamp,
                "response": result
                }
                
            return NodeExecutionResult(
                outputs={"telegram_result": output_data},
                status="success",
                logs=[
                    f"Message sent successfully to chat {chat_id}",
                    f"Message: {message[:50]}{'...' if len(message) > 50 else ''}"
                ]
                )
        else:
            error_message = f"Failed to send message: {response.text}"
            if hasattr(response, 'text'):
                error_message += f" - {response.text}"
            logger.error(error_message)
            
            return NodeExecutionResult(
                outputs={},
                status="error",
                error=error_message
            )
            
    except Exception as e:
        logger.error(f" Error in telegram_message_action: {str(e)}")
        logger.error(f" Traceback: {traceback.format_exc()}")
        
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Error sending Telegram message: {str(e)}"
        )
