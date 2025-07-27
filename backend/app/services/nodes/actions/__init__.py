from app.core.node_registry import NodeRegistry
from .tel_send_message_for_self import get_telegram_send_message_for_self_node_type, execute_telegram_send_message_for_self

def register_action_nodes(registry: NodeRegistry):
    """Register all action nodes"""
    # Register Telegram Send Message (Self) node
    node_type = get_telegram_send_message_for_self_node_type()
    registry.register_node(node_type, execute_telegram_send_message_for_self)