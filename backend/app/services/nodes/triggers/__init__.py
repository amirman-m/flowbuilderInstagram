from app.core.node_registry import NodeRegistry
from .chat_input import get_chat_input_node_type, execute_chat_input_trigger
from .voice_input import get_voice_input_node_type, execute_voice_input_trigger
from .telegram_input import get_telegram_input_node_type, execute_telegram_input_trigger

def register_trigger_nodes(registry: NodeRegistry):
    """Register all trigger nodes"""
    # Register Chat Input node
    node_type = get_chat_input_node_type()
    registry.register_node(node_type, execute_chat_input_trigger)
    
    # Register Voice Input node
    node_type = get_voice_input_node_type()
    registry.register_node(node_type, execute_voice_input_trigger)
    
    # Register Telegram Input node
    node_type = get_telegram_input_node_type()
    registry.register_node(node_type, execute_telegram_input_trigger)

