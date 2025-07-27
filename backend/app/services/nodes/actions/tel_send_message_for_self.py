from typing import Dict, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
import os
import uuid
import base64
import tempfile

def get_telegram_send_message_for_self_node_type() -> NodeType:
    return NodeType(
        id="telegram-send-message-for-self",
        name="Telegram Send Message (Self)",
        description="Sends a message to your own Telegram account.",
        category=NodeCategory.ACTION,
        version="1.0.0",
        icon="telegram",
        color="#0088cc",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="message",
                    name="Message",
                    label="Message",
                    description="The message content to send",
                    data_type=[NodeDataType.STRING],
                    required=True
                )
            ],
            outputs=[]
        ),
        settings_schema={
            "type": "object",
            "properties": {
                "bot_token": {
                    "type": "string",
                    "title": "Bot Token",
                    "description": "Your Telegram bot token."
                }
            },
            "required": ["bot_token"]
        }
    )

async def execute_telegram_send_message_for_self(context: Dict[str, Any]) -> NodeExecutionResult:
    pass
