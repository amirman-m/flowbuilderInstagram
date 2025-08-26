from app.core.node_registry import NodeRegistry
from .telegram_message_action import get_telegram_output_message_node_type, execute_telegram_output_message
from .telegram_voice_action import get_telegram_output_voice_node_type, execute_telegram_output_voice

def register_action_nodes(registry: NodeRegistry):
    """Register all action nodes"""
    # Register Telegram Send Message node
    node_type = get_telegram_output_message_node_type()
    registry.register_node(node_type, execute_telegram_output_message)

    # Register Telegram Send Voice node
    voice_node_type = get_telegram_output_voice_node_type()
    registry.register_node(voice_node_type, execute_telegram_output_voice)