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
from openai import OpenAI


SUPPORTED_MODELS = ["tts-1", "tts-1-hd", "gpt-4o-mini-tts"]
SUPPORTED_VOICES = [
    "alloy", "ash", "ballad", "coral", "echo", "fable",
    "onyx", "nova", "sage", "shimmer", "verse",
]
SUPPORTED_FORMATS = ["mp3", "opus", "aac", "flac", "wav", "pcm"]


def get_openai_speech_node_type() -> NodeType:
    # One STRING input, one STRING output (audio as data URI string)
    return NodeType(
        id="openai_speech",
        name="OpenAI Speech",
        description="Generate speech audio from text using OpenAI TTS models",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="volume_up",
        color="#8E44AD",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="input_text",
                    name="input_text",
                    label="Text",
                    description="The text to synthesize (string)",
                    dataType=[NodeDataType.STRING],
                    required=True,
                ),
            ],
            outputs=[
                NodePort(
                    id="voice_output",
                    name="voice_output",
                    label="Voice Output",
                    description="Base64 audio as data URI string",
                    dataType=NodeDataType.OBJECT,
                    required=True,
                ),
            ],
        ),
        settingsSchema={
            "type": "object",
            "properties": {
                "model": {
                    "type": "string",
                    "description": "TTS model",
                    "enum": SUPPORTED_MODELS,
                    "default": "tts-1",
                },
                "voice": {
                    "type": "string",
                    "description": "Voice to use",
                    "enum": SUPPORTED_VOICES,
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
                    "default": "opus",
                },
            },
            "required": ["model", "voice"],
        },
    )


def _pick_text_from_inputs(inputs: Dict[str, Any]) -> Optional[str]:
    # Prefer direct string at known input port, but be resilient:
    # - direct string on any port
    # - dicts containing 'ai_response' or 'input_text'
    for port_id, value in inputs.items():
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            if isinstance(value.get("ai_response"), str) and value["ai_response"].strip():
                return value["ai_response"].strip()
            if isinstance(value.get("input_text"), str) and value["input_text"].strip():
                return value["input_text"].strip()
            # Fallback: first string value in dict
            for _, v in value.items():
                if isinstance(v, str) and v.strip():
                    return v.strip()
    return None


def _mime_for_format(fmt: str) -> str:
    m = fmt.lower()
    if m == "mp3":
        return "audio/mpeg"
    if m == "opus":
        return "audio/opus"
    if m == "aac":
        return "audio/aac"
    if m == "flac":
        return "audio/flac"
    if m == "wav":
        return "audio/wav"
    if m == "pcm":
        # 16-bit PCM in a raw container; leave as audio/wav alternative? stick to audio/wav if needed
        return "audio/pcm"
    return "audio/opus"


async def execute_openai_speech(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute OpenAI Speech (TTS) node.
    Accepts a string input and returns a base64 data URI string with synthesized audio.
    """
    started = datetime.now(timezone.utc)
    inputs = context.get("inputs", {}) or {}
    settings = context.get("settings", {}) or {}

    # Extract text input
    input_text = None
    # Accept primary 'input_text' if provided explicitly
    if isinstance(inputs.get("input_text"), str) and inputs["input_text"].strip():
        input_text = inputs["input_text"].strip()
    else:
        # Fallback: scan other inputs like simple_openAI_chat
        input_text = _pick_text_from_inputs(inputs)

    if not input_text:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="No valid string input found. Connect a node that outputs text or map it to 'input_text' port.",
            started_at=started,
            completed_at=datetime.now(timezone.utc),
        )

    # Load settings with defaults
    model = settings.get("model", "tts-1")
    voice = settings.get("voice")
    speed = settings.get("speed", 1.0)
    response_format = settings.get("response_format", "opus")

    # Validate settings
    if model not in SUPPORTED_MODELS:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Unsupported model '{model}'. Supported: {', '.join(SUPPORTED_MODELS)}",
            started_at=started,
            completed_at=datetime.now(timezone.utc),
        )
    if not voice or voice not in SUPPORTED_VOICES:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Invalid or missing voice. Supported voices: {', '.join(SUPPORTED_VOICES)}",
            started_at=started,
            completed_at=datetime.now(timezone.utc),
        )
    if response_format not in SUPPORTED_FORMATS:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Unsupported response_format '{response_format}'. Supported: {', '.join(SUPPORTED_FORMATS)}",
            started_at=started,
            completed_at=datetime.now(timezone.utc),
        )

    try:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set or empty")

        client = OpenAI(api_key=api_key)

        # Call OpenAI TTS
        # OpenAI Python SDK v1.x:
        # resp = client.audio.speech.create(model=..., voice=..., input=..., response_format=..., speed=...)
        resp = client.audio.speech.create(
            model=model,
            voice=voice,
            input=input_text,
            response_format=response_format,
            speed=speed,
        )

        # 'resp' contains binary audio in resp.content
        audio_bytes: bytes = resp.content if hasattr(resp, "content") else bytes(resp)  # best effort

        # Encode as data URI
        mime = _mime_for_format(response_format)
        b64 = base64.b64encode(audio_bytes).decode("ascii")
        data_uri = f"data:{mime};base64,{b64}"

        completed = datetime.now(timezone.utc)
        return NodeExecutionResult(
            outputs={
                "voice_output": data_uri
            },
            status="success",
            started_at=started,
            completed_at=completed,
            logs=[
                f"OpenAI TTS generated {response_format} audio using {model} voice={voice} speed={speed}"
            ],
        )
    except Exception as e:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"OpenAI TTS error: {str(e)}",
            started_at=started,
            completed_at=datetime.now(timezone.utc),
        )