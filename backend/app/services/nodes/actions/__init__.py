import logging
from app.core.node_registry import NodeRegistry
from .telegram_message_action import get_telegram_output_message_node_type, execute_telegram_output_message
from .telegram_voice_action import get_telegram_output_voice_node_type, execute_telegram_output_voice
from .telegram_send_photo import get_telegram_send_photo_node_type, execute_telegram_send_photo

logger = logging.getLogger(__name__)

def register_action_nodes(registry: NodeRegistry):
    """Register all action nodes"""
    logger.info("Starting action node registration...")
    
    # Register Telegram Send Message node
    try:
        node_type = get_telegram_output_message_node_type()
        registry.register_node(node_type, execute_telegram_output_message)
        logger.info(f"Registered Telegram Send Message node: {node_type.id}")
    except Exception as e:
        logger.error(f"Failed to register Telegram Send Message node: {e}")

    # Register Telegram Send Voice node
    try:
        voice_node_type = get_telegram_output_voice_node_type()
        registry.register_node(voice_node_type, execute_telegram_output_voice)
        logger.info(f"Registered Telegram Send Voice node: {voice_node_type.id}")
    except Exception as e:
        logger.error(f"Failed to register Telegram Send Voice node: {e}")

    # Register Telegram Send Photo node
    try:
        photo_node_type = get_telegram_send_photo_node_type()
        registry.register_node(photo_node_type, execute_telegram_send_photo)
        logger.info(f"Registered Telegram Send Photo node: {photo_node_type.id}")
    except Exception as e:
        logger.error(f"Failed to register Telegram Send Photo node: {e}")

    
    
    logger.info("Action node registration completed")