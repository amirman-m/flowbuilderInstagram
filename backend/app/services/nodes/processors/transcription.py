from typing import Dict, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
import os
import uuid
import base64
import tempfile
from openai import OpenAI

def get_transcription_node_type() -> NodeType:
    return NodeType(
        id="transcription",
        name="Audio Transcription",
        description="Transcribes audio to text using OpenAI's transcription API",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="transcribe",
        color="#2196F3",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Contains voice input data from voice input node",
                    data_type=[NodeDataType.OBJECT],
                    required=True
                )
            ],
            outputs=[
                NodePort(
                    id="ai_response",
                    name="ai_response",
                    label="Transcription",
                    description="The transcribed text from the audio",
                    data_type=NodeDataType.STRING,
                    required=True
                )
            ]
        ),
        settings_schema={
            "type": "object",
            "properties": {},  # No settings needed for transcription
            "required": []
        }
    )

async def execute_transcription(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute transcription node
    This node accepts voice input from a voice input node and transcribes it using OpenAI's API
    """
    # Get all inputs from connected nodes
    inputs = context.get("inputs", {})
    
    # Find voice input data from connected nodes
    voice_data = None
    input_source = None
    session_id = None
    
    for port_id, port_data in inputs.items():
        if isinstance(port_data, dict):
            # Check for voice_input from voice input node
            if "voice_input" in port_data and port_data.get("input_type") == "voice":
                voice_data = port_data["voice_input"]
                input_source = f"{port_id}.voice_input"
                session_id = port_data.get("session_id")
                break
            # Check for message_data structure that contains voice_input
            elif "message_data" in port_data and isinstance(port_data["message_data"], dict):
                message_data = port_data["message_data"]
                if "voice_input" in message_data and message_data.get("input_type") == "voice":
                    voice_data = message_data["voice_input"]
                    input_source = f"{port_id}.message_data.voice_input"
                    session_id = message_data.get("session_id")
                    break
    
    # Generate session_id if not provided
    if not session_id:
        session_id = str(uuid.uuid4())
    
    if not voice_data:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="No voice input found from connected nodes. Please connect a Voice Input node."
        )
    
    try:
        # Get API key from environment
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set or empty")
        
        # Initialize OpenAI client
        client = OpenAI(api_key=api_key)
        
        # Create a temporary file to store the audio data
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_file:
            # Check if voice_data is base64 encoded
            if isinstance(voice_data, str) and voice_data.startswith(('data:', 'http:', 'https:')):
                # Handle data URI format
                if voice_data.startswith('data:'):
                    # Extract base64 data after the comma
                    header, encoded = voice_data.split(",", 1)
                    voice_data = base64.b64decode(encoded)
                    temp_file.write(voice_data)
            elif isinstance(voice_data, str):
                # Assume it's base64 encoded
                try:
                    decoded_data = base64.b64decode(voice_data)
                    temp_file.write(decoded_data)
                except Exception as e:
                    print(f"Error decoding base64: {e}")
                    # If not base64, write as is (might be a file path)
                    temp_file.write(voice_data.encode('utf-8'))
            elif isinstance(voice_data, bytes):
                # Direct binary data
                temp_file.write(voice_data)
            
            temp_file_path = temp_file.name
        
        print(f"Temporary audio file created at: {temp_file_path}")
        
        # Process with OpenAI
        try:
            with open(temp_file_path, "rb") as audio_file:
                # Call OpenAI transcription API
                transcription = client.audio.transcriptions.create(
                    model="gpt-4o-transcribe",  # Using gpt-4o-transcribe model
                    file=audio_file,
                    response_format="text"
                )
                
                # Extract transcribed text
                transcribed_text = transcription
                print(f"Transcription successful: {transcribed_text[:50]}...")
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                print(f"Temporary file removed: {temp_file_path}")
        
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Transcription API error: {str(e)}"
        )
    
    # Create comprehensive output structure
    timestamp = datetime.now(timezone.utc).isoformat()
    
    output_data = {
        "session_id": session_id,
        "input_type": "voice",
        "ai_response": transcribed_text,
        "timestamp": timestamp,
        "metadata": {
            "model": "gpt-4o-transcribe",
            "input_source": input_source
        }
    }
    
    # Return the comprehensive response
    return NodeExecutionResult(
        outputs={"ai_response": output_data},
        status="success",
        logs=[
            f"Audio transcription generated: {transcribed_text[:50]}{'...' if len(transcribed_text) > 50 else ''}"
        ]
    )
