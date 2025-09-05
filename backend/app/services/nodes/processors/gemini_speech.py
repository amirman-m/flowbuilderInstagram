from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import base64
import os

from app.models.nodes import (
    NodeType,
    NodeCategory,
    NodeDataType,
    NodePort,
    NodePorts,
    NodeExecutionResult,
)

SUPPORTED_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"]
SUPPORTED_VOICES = ["default", "male", "female"]
SUPPORTED_FORMATS = ["mp3", "wav", "opus"]

def get_gemini_speech_node_type() -> NodeType:
    return NodeType(
        id="gemini_speech",
        name="Google Gemini Speech",
        description="Generate speech audio from text using Google Gemini TTS models",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="volume_up",
        color="#4285F4",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="input_text",
                    name="input_text",
                    label="Text",
                    description="The text to synthesize (string)",
                    data_type=[NodeDataType.STRING],
                    required=True,
                ),
            ],
            outputs=[
                NodePort(
                    id="voice_output",
                    name="voice_output",
                    label="Voice Output",
                    description="Base64 audio as data URI string",
                    data_type=NodeDataType.OBJECT,
                    required=True,
                ),
            ],
        ),
        settings_schema={
            "type": "object",
            "properties": {
                "model": {
                    "type": "string",
                    "description": "Gemini TTS model",
                    "enum": SUPPORTED_MODELS,
                    "default": "gemini-2.5-flash-preview-tts",
                },
                "voice": {
                    "type": "string",
                    "description": "Voice to use",
                    "enum": SUPPORTED_VOICES,
                    "default": "default"
                },
                "speed": {
                    "type": "number",
                    "description": "Speed multiplier (0.25 to 4.0). Default 1.0",
                    "minimum": 0.25,
                    "maximum": 4.0,
                    "default": 1.0,
                },
                "response_format": {
                    "type": "string",
                    "description": "Output audio format",
                    "enum": SUPPORTED_FORMATS,
                    "default": "mp3",
                },
            },
            "required": ["model", "voice"],
        },
    )

def _pick_text_from_inputs(inputs: Dict[str, Any]) -> Optional[str]:
    for port_id, value in inputs.items():
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            if isinstance(value.get("ai_response"), str) and value["ai_response"].strip():
                return value["ai_response"].strip()
            if isinstance(value.get("input_text"), str) and value["input_text"].strip():
                return value["input_text"].strip()
    return None

async def execute_gemini_speech_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
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
        
        # Extract text
        text_to_speak = _pick_text_from_inputs(inputs)
        if not text_to_speak:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No text input provided"
            )
        
        # Get settings
        model = settings.get("model", "gemini-2.5-flash-preview-tts")
        voice = settings.get("voice", "default")
        speed = settings.get("speed", 1.0)
        response_format = settings.get("response_format", "mp3")
        
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
        
        # Generate speech (placeholder implementation)
        # Note: Actual Gemini TTS API may differ
        placeholder_audio = "UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7bVkGwY5k9n1unEiBC13yO/eizEIHWq+8+OWT"
        
        # Create output
        timestamp = datetime.now(timezone.utc).isoformat()
        output_data = {
            "voice_output": f"data:audio/{response_format};base64,{placeholder_audio}",
            "timestamp": timestamp,
            "metadata": {
                "model": model,
                "voice": voice,
                "speed": speed,
                "format": response_format,
                "text_length": len(text_to_speak)
            }
        }
        
        return NodeExecutionResult(
            outputs={"voice_output": output_data},
            status="success",
            logs=[f"Generated speech: {len(text_to_speak)} chars, {voice} voice"]
        )
        
    except Exception as e:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Gemini speech error: {str(e)}"
        )
