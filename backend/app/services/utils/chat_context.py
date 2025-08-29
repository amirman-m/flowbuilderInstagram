from typing import Dict, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class ChatContextExtractor:
    """Utility class to extract chat context from node inputs"""
    
    @staticmethod
    def extract_chat_context(inputs: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract chat_id and bot_id from node inputs
        
        Args:
            inputs: Dictionary of inputs from connected nodes
            
        Returns:
            Tuple of (chat_id, bot_id) or (None, None) if not found
        """
        chat_id = None
        bot_id = None
        
        try:
            # Search through all input ports for chat context
            for port_id, port_data in inputs.items():
                if isinstance(port_data, dict):
                    # Check for direct chat_id and bot_id fields
                    if "chat_id" in port_data:
                        chat_id = str(port_data["chat_id"])
                    if "bot_id" in port_data:
                        bot_id = str(port_data["bot_id"])
                    
                    # Check for Telegram-specific fields
                    if "telegram_chat_id" in port_data:
                        chat_id = str(port_data["telegram_chat_id"])
                    if "telegram_bot_id" in port_data:
                        bot_id = str(port_data["telegram_bot_id"])
                    
                    # Check nested metadata
                    if "metadata" in port_data and isinstance(port_data["metadata"], dict):
                        metadata = port_data["metadata"]
                        if "chat_id" in metadata:
                            chat_id = str(metadata["chat_id"])
                        if "bot_id" in metadata:
                            bot_id = str(metadata["bot_id"])
                        if "telegram_chat_id" in metadata:
                            chat_id = str(metadata["telegram_chat_id"])
                        if "telegram_bot_id" in metadata:
                            bot_id = str(metadata["telegram_bot_id"])
                    
                    # If we found both, we can stop searching
                    if chat_id and bot_id:
                        break
            
            if chat_id and bot_id:
                logger.info(f"Extracted chat context: chat_id={chat_id}, bot_id={bot_id}")
            else:
                logger.debug(f"Chat context not found in inputs. chat_id={chat_id}, bot_id={bot_id}")
            
            return chat_id, bot_id
            
        except Exception as e:
            logger.error(f"Error extracting chat context: {str(e)}")
            return None, None
    
    @staticmethod
    def should_use_chat_mode(mode: str, chat_id: Optional[str], bot_id: Optional[str], bot_is_active: bool) -> bool:
        """
        Determine if chat mode should be used based on settings and context
        
        Args:
            mode: User-selected mode ("completion" or "chat")
            chat_id: Extracted chat ID
            bot_id: Extracted bot ID
            bot_is_active: Whether the bot is active
            
        Returns:
            True if chat mode should be used, False for completion mode
        """
        # If user explicitly chose completion, use completion
        if mode == "completion":
            return False
        
        # If user chose chat but we don't have the required context, fall back to completion
        if mode == "chat":
            if not chat_id or not bot_id or not bot_is_active:
                logger.info(f"Chat mode requested but requirements not met. "
                          f"chat_id={chat_id}, bot_id={bot_id}, bot_active={bot_is_active}. "
                          f"Falling back to completion mode.")
                return False
            return True
        
        # Default to completion for unknown modes
        return False

# Convenience functions
def extract_chat_context(inputs: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """Extract chat_id and bot_id from inputs"""
    return ChatContextExtractor.extract_chat_context(inputs)

def should_use_chat_mode(mode: str, chat_id: Optional[str], bot_id: Optional[str], bot_is_active: bool) -> bool:
    """Determine if chat mode should be used"""
    return ChatContextExtractor.should_use_chat_mode(mode, chat_id, bot_id, bot_is_active)
