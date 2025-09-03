from typing import Dict, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

def get_text_field_node_type() -> NodeType:
    return NodeType(
        id="text_field",
        name="Text Field",
        description="Passes through input data and optionally adds text from settings if no input_text exists",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="text",
        color="#2196F3",  # Blue color
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="input_data",
                    name="input_data",
                    label="Input Data",
                    description="Any input data to pass through",
                    data_type=[NodeDataType.OBJECT, NodeDataType.STRING],
                    required=True,
                )
            ],
            outputs=[
                NodePort(
                    id="output_data",
                    name="output_data", 
                    label="Output Data",
                    description="Input data passed through with optional text field added",
                    data_type=[NodeDataType.OBJECT, NodeDataType.STRING],
                    required=True,
                )
            ],
        ),
        settings_schema={
            "type": "object",
            "properties": {
                "text_content": {
                    "type": "string",
                    "title": "Text Content",
                    "description": "Text to add as input_text if not already present in input",
                    "default": ""
                },
                "prepend_username": {
                    "type": "boolean",
                    "title": "Prepend Username",
                    "description": "Add @username at the beginning of text_content when username exists in input data",
                    "default": False
                }
            },
            "required": []
        },
    )

def extract_username_from_input(input_data: Any) -> str:
    """
    Extract username from telegram input data structure.
    Searches for username in various nested locations based on telegram webhook structure.
    """
    if not isinstance(input_data, dict):
        return None
    
    # Search patterns based on the provided log data structure
    username_paths = [
        # Direct username in join_details (for join events)
        ["join_details", 0, "username"],
        # Direct username in leave_details (for leave events) 
        ["leave_details", 0, "username"],
        # Username from new_chat_members (join events)
        ["new_chat_members", 0, "username"],
        # Username from left_chat_member (leave events)
        ["left_chat_member", "username"],
        # Username from webhook_data.from (message sender)
        ["metadata", "webhook_data", "from", "username"],
        # Username from webhook_data.new_chat_member (join events)
        ["metadata", "webhook_data", "new_chat_member", "username"],
        # Username from webhook_data.left_chat_member (leave events)
        ["metadata", "webhook_data", "left_chat_member", "username"],
        # Direct from field
        ["from", "username"],
        # Direct username field
        ["username"]
    ]
    
    for path in username_paths:
        try:
            current = input_data
            for key in path:
                if isinstance(current, list) and isinstance(key, int):
                    if len(current) > key:
                        current = current[key]
                    else:
                        break
                elif isinstance(current, dict) and key in current:
                    current = current[key]
                else:
                    break
            else:
                # If we made it through the entire path without breaking
                if isinstance(current, str) and current:
                    return current
        except (KeyError, IndexError, TypeError):
            continue
    
    return None

async def execute_text_field(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute text field processor node.
    Passes through input data and adds text from settings as input_text only if not already present.
    """
    try:
        # Get inputs and settings
        inputs = context.get("inputs", {})
        settings = context.get("settings", {})
        
        # Extract input data
        input_data = inputs.get("input_data")
        if input_data is None:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Text Field requires 'input_data' input"
            )
        
        # Get text content and username settings
        text_content = settings.get("text_content", "")
        prepend_username = settings.get("prepend_username", False)
        
        # Extract username from input data if prepend_username is enabled
        username_to_prepend = None
        if prepend_username and text_content:
            username_to_prepend = extract_username_from_input(input_data)
        
        # Prepare output data by copying input
        if isinstance(input_data, dict):
            output_data = input_data.copy()
        elif isinstance(input_data, str):
            # Convert string input to object format
            output_data = {"content": input_data}
        else:
            # Handle other types by wrapping in object
            output_data = {"value": input_data}
        
        # Only add input_text if it doesn't already exist and text_content is provided
        if text_content and "input_text" not in output_data:
            # Prepend username if checkbox is active and username exists
            final_text_content = text_content
            if username_to_prepend:
                final_text_content = f"@{username_to_prepend} {text_content}"
                log_message = f"Text Field added input_text with username: '@{username_to_prepend} {text_content[:30]}{'...' if len(text_content) > 30 else ''}'"
            else:
                log_message = f"Text Field added input_text: '{text_content[:50]}{'...' if len(text_content) > 50 else ''}'"
            
            output_data["input_text"] = final_text_content
        else:
            if "input_text" in output_data:
                log_message = "Text Field passed through existing input_text without modification"
            else:
                log_message = "Text Field passed through input data (no text content configured)"
        
        return NodeExecutionResult(
            outputs={"output_data": output_data},
            status="success",
            logs=[log_message],
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
        
    except Exception as e:
        logger.error(f"Error in Text Field processor: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Text Field execution failed: {str(e)}",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
