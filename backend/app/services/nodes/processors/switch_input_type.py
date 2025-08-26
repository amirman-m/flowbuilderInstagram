from typing import Dict, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
import logging

logger = logging.getLogger(__name__)


def get_switch_input_type_node_type() -> NodeType:
    return NodeType(
        id="switch-input-type",
        name="Switch Input Type",
        description="Routes incoming message_data to text/voice/other based on detected type without modifying payload",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="switch",
        color="#8E24AA",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Payload from input nodes (e.g., TelegramInput). Contains input_text, input_type, metadata, etc.",
                    data_type=[NodeDataType.OBJECT, NodeDataType.STRING],
                    required=True,
                )
            ],
            outputs=[
                NodePort(
                    id="text",
                    name="text",
                    label="Text",
                    description="Emits the original payload if input is detected as text",
                    data_type=NodeDataType.STRING,
                    required=False,
                ),
                NodePort(
                    id="voice",
                    name="voice",
                    label="Voice",
                    description="Emits the original payload if input is detected as voice/audio",
                    data_type=NodeDataType.OBJECT,
                    required=False,
                ),
                NodePort(
                    id="other",
                    name="other",
                    label="Other",
                    description="Emits the original payload if input type is unknown/other",
                    data_type=NodeDataType.OBJECT,
                    required=False,
                ),
            ],
        ),
        settings_schema={
            "type": "object",
            "properties": {},
            "required": [],
        },
    )


async def execute_switch_input_type(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Determine input type (voice/text/other) from incoming payload and route it to the matching output.
    Payload is passed through unchanged on exactly one output port.
    """
    # Normalize inputs
    inputs = context.get("inputs", {}) or {}

    # Support fallback: some callers might pass flattened structure
    message_data = inputs.get("message_data")
    if message_data is None and isinstance(inputs, dict):
        # Try to find the first dict-like payload
        for _, v in inputs.items():
            if isinstance(v, dict):
                message_data = v
                break

    if not isinstance(message_data, dict):
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="Switch node requires 'message_data' object input",
        )

    # Detection heuristics
    input_type = str(message_data.get("input_type", "")).lower()
    metadata = message_data.get("metadata") or {}
    mime = str(metadata.get("mime_type", "")).lower()

    # Voice conditions
    voice_indicators = [
        mime.startswith("audio/"),
        input_type == "voice",
        any(k in message_data for k in ["audio_url", "audio_file_id", "voice_file_id", "duration_ms", "audio_duration_ms"]),
    ]

    is_voice = any(voice_indicators)
    is_text = (input_type == "text") or isinstance(message_data.get("input_text"), str)

    routed_to = None
    outputs: Dict[str, Any] = {}

    if is_voice and not is_text:
        routed_to = "voice"
        outputs["voice"] = message_data
    elif is_text and not is_voice:
        routed_to = "text"
        outputs["text"] = message_data
    else:
        # Ambiguous or unknown → other
        routed_to = "other"
        outputs["other"] = message_data

    logger.info(f"SwitchInputType routed to: {routed_to}")

    return NodeExecutionResult(
        outputs=outputs,
        status="success",
        logs=[f"Switch routed to: {routed_to}"],
    )
