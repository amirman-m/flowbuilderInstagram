from typing import Dict, Any, Optional
from datetime import datetime, timezone
import base64
import os
import logging

from app.models.nodes import (
    NodeType,
    NodeCategory,
    NodeDataType,
    NodePort,
    NodePorts,
    NodeExecutionResult,
)

logger = logging.getLogger(__name__)

SUPPORTED_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"]
SUPPORTED_LANGUAGES = ["auto", "en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh"]

def get_gemini_transcription_node_type() -> NodeType:
    return NodeType(
        id="gemini_transcription",
        name="Google Gemini Transcription",
        description="Transcribe audio to text using Google Gemini models",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="mic",
        color="#4285F4",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="audio_input",
                    name="audio_input",
                    label="Audio Input",
                    description="Audio data (base64 data URI or binary data) to transcribe",
                    data_type=[NodeDataType.OBJECT, NodeDataType.STRING],
                    required=True,
                ),
            ],
            outputs=[
                NodePort(
                    id="transcription_output",
                    name="transcription_output",
                    label="Transcription Output",
                    description="Transcribed text from audio",
                    data_type=[NodeDataType.STRING],
                    required=True,
                ),
            ],
        ),
        settings_schema={
            "type": "object",
            "properties": {
                "model": {
                    "type": "string",
                    "description": "Gemini model to use for transcription",
                    "enum": SUPPORTED_MODELS,
                    "default": "gemini-2.5-flash",
                },
                "language": {
                    "type": "string",
                    "description": "Language of the audio (auto-detect if not specified)",
                    "enum": SUPPORTED_LANGUAGES,
                    "default": "auto"
                },
                "prompt": {
                    "type": "string",
                    "description": "Optional prompt to guide transcription style or context",
                    "default": "",
                    "maxLength": 1000
                }
            },
            "required": ["model"],
        },
    )

def extract_audio_data(audio_input: Any) -> Optional[str]:
    """Extract base64 audio data from various input formats."""
    try:
        if isinstance(audio_input, str):
            if audio_input.startswith('data:audio/'):
                if ';base64,' in audio_input:
                    return audio_input.split(';base64,')[1]
            elif len(audio_input) > 100:
                return audio_input
        elif isinstance(audio_input, dict):
            if 'voice_output' in audio_input:
                return extract_audio_data(audio_input['voice_output'])
            elif 'audio_data' in audio_input:
                return extract_audio_data(audio_input['audio_data'])
            elif 'base64' in audio_input:
                return extract_audio_data(audio_input['base64'])
        elif isinstance(audio_input, bytes):
            return base64.b64encode(audio_input).decode('utf-8')
        return None
    except Exception as e:
        logger.error(f"Error extracting audio data: {str(e)}")
        return None

async def execute_gemini_transcription_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    try:
        inputs = context.get("inputs", {})
        settings = context.get("settings", {})
        node_id = context.get("node_id", "unknown")
        
        # Get API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="GEMINI_API_KEY environment variable not set"
            )
        
        # Get audio input
        audio_input = inputs.get("audio_input")
        if not audio_input:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No audio input provided"
            )
        
        # Extract audio data
        base64_audio = extract_audio_data(audio_input)
        if not base64_audio:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Could not extract valid audio data from input"
            )
        
        # Get settings
        model = settings.get("model", "gemini-2.5-flash")
        language = settings.get("language", "auto")
        prompt = settings.get("prompt", "")
        
        # Import Gemini client
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="google-genai package not installed"
            )
        
        # Initialize client
        client = genai.Client(api_key=api_key)
        
        # Prepare audio content
        audio_content = {
            "mime_type": "audio/wav",
            "data": base64_audio
        }
        
        # Prepare prompt
        transcription_prompt = "Please transcribe this audio to text."
        if language != "auto":
            transcription_prompt += f" The audio is in {language}."
        if prompt:
            transcription_prompt += f" Additional context: {prompt}"
        
        # Configure generation
        config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0)
        )
        
        # Call Gemini API
        response = client.models.generate_content(
            model=model,
            contents=[
                {
                    "parts": [
                        {"text": transcription_prompt},
                        {"inline_data": audio_content}
                    ]
                }
            ],
            config=config
        )
        
        transcription_text = response.text
        
        # Extract usage info
        input_tokens = getattr(response, 'prompt_token_count', 'N/A')
        output_tokens = getattr(response, 'candidates_token_count', 'N/A')
        total_tokens = (input_tokens + output_tokens) if isinstance(input_tokens, int) and isinstance(output_tokens, int) else 'N/A'
        
        # Create output
        timestamp = datetime.now(timezone.utc).isoformat()
        output_data = {
            "transcription_output": transcription_text,
            "timestamp": timestamp,
            "metadata": {
                "model": model,
                "language": language,
                "prompt": prompt,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "audio_size_kb": len(base64_audio) * 3 / 4 / 1024
            }
        }
        
        return NodeExecutionResult(
            outputs={"transcription_output": output_data},
            status="success",
            logs=[
                f"Transcribed audio: {len(transcription_text)} chars",
                f"Model: {model}, Language: {language}, Tokens: {total_tokens}"
            ]
        )
        
    except Exception as e:
        logger.error(f"Gemini transcription error: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Gemini transcription error: {str(e)}"
        )
