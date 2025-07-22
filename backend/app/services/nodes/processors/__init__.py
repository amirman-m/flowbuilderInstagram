from app.core.node_registry import NodeRegistry
from .simple_openAI_chat import get_simple_openai_chat_node_type, execute_simple_openai_chat

def register_processor_nodes(registry: NodeRegistry):
    """Register all processor nodes"""
    # Register OpenAI Chat node
    node_type = get_simple_openai_chat_node_type()
    registry.register_node(node_type, execute_simple_openai_chat)