from typing import Dict, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
import logging

logger = logging.getLogger(__name__)


def get_switch_input_type_node_type() -> NodeType:
    return NodeType(
        id="switch-input-type",
        name="Switch Input Type",
        description="Routes incoming message_data to text/voice/photo/document/file/other based on detected type without modifying payload",
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
                    id="photo",
                    name="photo",
                    label="Photo",
                    description="Emits the original payload if input is detected as photo/image",
                    data_type=NodeDataType.OBJECT,
                    required=False,
                ),
                NodePort(
                    id="document",
                    name="document",
                    label="Document",
                    description="Emits the original payload if input is detected as document",
                    data_type=NodeDataType.OBJECT,
                    required=False,
                ),
                NodePort(
                    id="file",
                    name="file",
                    label="File",
                    description="Emits the original payload if input is detected as file (video/audio/animation/sticker)",
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
    Determine input type from incoming payload and route it to the matching output port.
    Supports: text, voice, photo, document, file, other.
    Payload is passed through unchanged on exactly one output port.
    Note: join/leave events are handled by dedicated checker nodes, not routed here.
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

    # Determine routing based on input_type and content analysis
    routed_to = None
    outputs: Dict[str, Any] = {}

    # Priority 1: Media types
    if input_type == "photo" or "photo_input" in message_data:
        routed_to = "photo"
        outputs["photo"] = message_data
    elif input_type == "document" or "document_input" in message_data:
        routed_to = "document"
        outputs["document"] = message_data
    elif input_type == "file" or "file_input" in message_data:
        routed_to = "file"
        outputs["file"] = message_data
    
    # Priority 2: Voice/Audio
    elif input_type == "voice" or "voice_input" in message_data or mime.startswith("audio/"):
        routed_to = "voice"
        outputs["voice"] = message_data
    
    # Priority 3: Text (most common, check last to avoid false positives)
    elif input_type == "text" or isinstance(message_data.get("input_text"), str) or isinstance(message_data.get("chat_input"), str):
        routed_to = "text"
        outputs["text"] = message_data
    
    # Fallback: Unknown/other types
    else:
        routed_to = "other"
        outputs["other"] = message_data

    logger.info(f"SwitchInputType routed to: {routed_to} (input_type: {input_type})")

    return NodeExecutionResult(
        outputs=outputs,
        status="success",
        logs=[f"Switch routed to: {routed_to} based on input_type: {input_type}"],
    )
