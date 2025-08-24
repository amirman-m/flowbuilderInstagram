import os
from typing import Dict, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
import uuid

def get_voice_input_node_type() -> NodeType:
    return NodeType(
        id="voice_input",
        name="Voice Input",
        description="Manual voice input trigger for testing and user interaction",
        category=NodeCategory.TRIGGER,
        version="1.0.0",
        icon="mic",
        color="#4CAF50",
        ports=NodePorts(
            inputs=[],  # Trigger nodes have no inputs
            outputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Contains session ID, voice input, and input type",
                    data_type=[NodeDataType.OBJECT],
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

async def execute_voice_input_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute voice input trigger node
    This node waits for voice input and creates a session for the conversation
    """
    
    # Get the voice data from the execution context
    voice_data = context.get("voice_data")
    content_type = context.get("content_type")
    send_to_transcription = context.get("send_to_transcription", False)
    
    if not voice_data:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="No voice data provided"
        )
    
    # Create a session for the conversation
    session_id = str(uuid.uuid4())
    
    # Create the output data structure
    message_data = {
        "session_id": session_id,
        "voice_input": voice_data,  # Changed from input_text to voice_input
        "input_type": "voice",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "send_to_transcription": send_to_transcription,
        "metadata": {
            "file_size": len(voice_data) if isinstance(voice_data, bytes) else os.path.getsize(voice_data) if os.path.exists(voice_data) else 0,
            "content_type": content_type
        }
    }
    
    # Return the session ID as output
    return NodeExecutionResult(
        outputs={"message_data": message_data},
        status="success",
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        logs=[f"Voice input processed: {type(voice_data).__name__}"]
    )