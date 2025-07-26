from typing import Dict, List, Callable, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
from app.services.utils.input_type import determine_input_type
import uuid
# Node definition
def get_chat_input_node_type() -> NodeType:
    return NodeType(
        id="chat-input",
        name="Chat Input",
        description="Manual text input trigger for testing and user interaction",
        category=NodeCategory.TRIGGER,
        version="1.0.0",
        icon="message",
        color="#4CAF50",
        ports=NodePorts(
            inputs=[],  # Trigger nodes have no inputs
            outputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Contains session ID, input text, and input type",
                    data_type=[NodeDataType.STRING],
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
async def execute_chat_input_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute chat input trigger node
    This node waits for user input and creates a session for the conversation
    """
    
    # Get the input text from the execution context
    user_input = context.get("user_input", "")
    
    if not user_input:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="No user input provided"
        )
    
    # Create a session for the conversation
    session_id = str(uuid.uuid4())
    
    # Determine input type based on content analysis
    input_type = determine_input_type(user_input)
    
    # Create the output data structure
    message_data = {
        "session_id": session_id,
        "input_text": user_input,
        "input_type": input_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "character_count": len(user_input),
            "word_count": len(user_input.split()),
        }
    }
    # Return the session ID as output
    return NodeExecutionResult(
        outputs={"message_data": message_data},
        status="success",
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        logs=[f"Chat input processed: \"{user_input[:50]}{'...' if len(user_input) > 50 else ''}\""]
    )