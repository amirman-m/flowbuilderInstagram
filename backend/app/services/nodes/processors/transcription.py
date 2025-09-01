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
    send_to_transcription = True  # Default to True if not specified
    
    for port_id, port_data in inputs.items():
        if isinstance(port_data, dict):
            # Check for voice_input from voice input node
            if "voice_input" in port_data and port_data.get("input_type") == "voice":
                # Check if send_to_transcription flag is present and False
                if "send_to_transcription" in port_data and port_data["send_to_transcription"] is False:
                    continue  # Skip this input if transcription is disabled
                    
                voice_data = port_data["voice_input"]
                input_source = f"{port_id}.voice_input"
                session_id = port_data.get("session_id")
                break
                
            # Check for message_data structure that contains voice_input
            elif "message_data" in port_data and isinstance(port_data["message_data"], dict):
                message_data = port_data["message_data"]
                if "voice_input" in message_data and message_data.get("input_type") == "voice":
                    # Check if send_to_transcription flag is present and False
                    if "send_to_transcription" in message_data and message_data["send_to_transcription"] is False:
                        continue  # Skip this input if transcription is disabled
                        
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
        
        # Extract file extension from data URI if available
        def get_file_extension_from_data_uri(data_uri: str) -> str:
            """Extract file extension from data URI name parameter or MIME type."""
            if ";name=" in data_uri:
                # Extract from name parameter: data:audio/ogg;name=voice.ogg;base64,...
                name_part = data_uri.split(";name=")[1].split(";")[0]
                if "." in name_part:
                    return "." + name_part.split(".")[-1]
            
            # Fallback to MIME type mapping
            if data_uri.startswith("data:"):
                mime_type = data_uri.split(";")[0].replace("data:", "").lower()
                if "ogg" in mime_type:
                    return ".ogg"
                elif "webm" in mime_type:
                    return ".webm"
                elif "mp3" in mime_type or "mpeg" in mime_type:
                    return ".mp3"
                elif "wav" in mime_type:
                    return ".wav"
                elif "m4a" in mime_type or "mp4" in mime_type:
                    return ".m4a"
            
            return ".webm"  # Default fallback

        # Determine proper file extension
        file_extension = ".webm"  # Default
        if isinstance(voice_data, str) and voice_data.startswith('data:'):
            file_extension = get_file_extension_from_data_uri(voice_data)

        # Create a temporary file to store the audio data
        with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
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
        
        # Small debug: show inferred extension and size
        try:
            inferred_len = os.path.getsize(temp_file_path)
        except Exception:
            inferred_len = -1
        print(f"Temporary audio file created at: {temp_file_path} with extension: {file_extension}, size={inferred_len} bytes")
        
        # Process with OpenAI
        try:
            with open(temp_file_path, "rb") as audio_file:
                # Call OpenAI transcription API (first attempt)
                transcription = client.audio.transcriptions.create(
                    model="gpt-4o-transcribe",  # Using gpt-4o-transcribe model
                    file=audio_file,
                    response_format="text"
                )
                # Extract transcribed text as string
                transcribed_text = transcription
                print(f"Transcription successful (primary ext {file_extension}): {transcribed_text[:50]}...")
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                print(f"Temporary file removed: {temp_file_path}")
        
    except Exception as e:
        # If initial attempt failed, try a fallback with an alternate extension (.ogg <-> .webm)
        err_msg = str(e)
        print(f"Transcription error (primary attempt): {err_msg}")

        # Decide fallback extension
        alt_ext = None
        if file_extension.lower() != ".ogg":
            alt_ext = ".ogg"
        elif file_extension.lower() != ".webm":
            alt_ext = ".webm"

        if alt_ext:
            try:
                # Recreate temp file with alternate extension and same bytes
                raw_bytes: bytes
                if isinstance(voice_data, bytes):
                    raw_bytes = voice_data
                elif isinstance(voice_data, str) and voice_data.startswith('data:'):
                    try:
                        _, encoded2 = voice_data.split(",", 1)
                        raw_bytes = base64.b64decode(encoded2)
                    except Exception:
                        raw_bytes = b""
                elif isinstance(voice_data, str):
                    try:
                        raw_bytes = base64.b64decode(voice_data)
                    except Exception:
                        raw_bytes = voice_data.encode('utf-8')
                else:
                    raw_bytes = b""

                with tempfile.NamedTemporaryFile(suffix=alt_ext, delete=False) as alt_file:
                    alt_file.write(raw_bytes)
                    alt_path = alt_file.name

                try:
                    print(f"Retrying transcription with alternate extension: {alt_ext} at {alt_path}")
                    with open(alt_path, "rb") as audio_file2:
                        transcription = client.audio.transcriptions.create(
                            model="gpt-4o-transcribe",
                            file=audio_file2,
                            response_format="text"
                        )
                        transcribed_text = transcription
                        print(f"Transcription successful (fallback ext {alt_ext}): {transcribed_text[:50]}...")

                    # Success on fallback: return transcribed text directly to match port schema
                    timestamp = datetime.now(timezone.utc).isoformat()
                    return NodeExecutionResult(
                        outputs={"ai_response": transcribed_text},
                        status="success",
                        logs=[
                            f"Audio transcription generated via fallback {alt_ext}: {transcribed_text[:50]}{'...' if len(transcribed_text) > 50 else ''}",
                            f"metadata: model=gpt-4o-transcribe, input_source={input_source}, fallback_used=True, fallback_extension={alt_ext}, timestamp={timestamp}, session_id={session_id}"
                        ]
                    )
                finally:
                    if os.path.exists(alt_path):
                        os.unlink(alt_path)
                        print(f"Temporary fallback file removed: {alt_path}")
            except Exception as e2:
                print(f"Fallback transcription error: {str(e2)}")

        # If we reach here, both attempts failed
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Transcription API error: {err_msg}"
        )
    
    # Return transcribed text directly to match declared output type (STRING)
    timestamp = datetime.now(timezone.utc).isoformat()
    return NodeExecutionResult(
        outputs={"ai_response": transcribed_text},
        status="success",
        logs=[
            f"Audio transcription generated: {transcribed_text[:50]}{'...' if len(transcribed_text) > 50 else ''}",
            f"metadata: model=gpt-4o-transcribe, input_source={input_source}, timestamp={timestamp}, session_id={session_id}"
        ]
    )
