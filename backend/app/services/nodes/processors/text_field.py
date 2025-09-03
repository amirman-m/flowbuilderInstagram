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
                }
            },
            "required": []
        },
    )

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
        
        # Get text content from settings
        text_content = settings.get("text_content", "")
        
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
            output_data["input_text"] = text_content
            log_message = f"Text Field added input_text: '{text_content[:50]}{'...' if len(text_content) > 50 else ''}'"
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
