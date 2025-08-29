from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from datetime import datetime, timezone
import json
import logging

logger = logging.getLogger(__name__)

# Configuration constants
MAX_CHAT_HISTORY = 20  # Maximum number of messages to keep per chat

class ChatMessage:
    """Represents a single chat message"""
    def __init__(self, role: str, content: str):
        self.role = role  # "user" or "assistant"
        self.content = content
    
    def to_dict(self) -> Dict[str, str]:
        return {"role": self.role, "content": self.content}
    
    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> 'ChatMessage':
        return cls(role=data["role"], content=data["content"])

class ChatHistoryService:
    """Service for managing AI chat conversation history"""
    
    @staticmethod
    def _get_db_session() -> Session:
        """Get database session"""
        return next(get_db())
    
    @staticmethod
    def load_chat_history(chat_id: str, bot_id: str) -> List[ChatMessage]:
        """
        Load chat history for a specific chat_id and bot_id
        
        Args:
            chat_id: Telegram chat ID or user identifier
            bot_id: Bot ID from telegram_bot_configs
            
        Returns:
            List of ChatMessage objects (empty list if no history)
        """
        try:
            db = ChatHistoryService._get_db_session()
            
            # Query chat history
            query = text("""
                SELECT messages 
                FROM chat_history 
                WHERE chat_id = :chat_id AND bot_id = :bot_id
            """)
            
            result = db.execute(query, {"chat_id": chat_id, "bot_id": bot_id}).fetchone()
            
            if result and result[0]:
                messages_data = result[0]  # JSONB data
                return [ChatMessage.from_dict(msg) for msg in messages_data]
            
            return []
            
        except Exception as e:
            logger.error(f"Error loading chat history for chat_id={chat_id}, bot_id={bot_id}: {str(e)}")
            return []
        finally:
            db.close()
    
    @staticmethod
    def save_chat_history(chat_id: str, bot_id: str, messages: List[ChatMessage]) -> bool:
        """
        Save chat history for a specific chat_id and bot_id
        Automatically limits to MAX_CHAT_HISTORY messages (removes oldest first)
        
        Args:
            chat_id: Telegram chat ID or user identifier
            bot_id: Bot ID from telegram_bot_configs
            messages: List of ChatMessage objects to save
            
        Returns:
            True if successful, False otherwise
        """
        try:
            db = ChatHistoryService._get_db_session()
            
            # Limit messages to MAX_CHAT_HISTORY (keep most recent)
            if len(messages) > MAX_CHAT_HISTORY:
                messages = messages[-MAX_CHAT_HISTORY:]
            
            # Convert messages to JSON format
            messages_json = [msg.to_dict() for msg in messages]
            
            # Upsert chat history
            query = text("""
                INSERT INTO chat_history (chat_id, bot_id, messages, updated_at)
                VALUES (:chat_id, :bot_id, :messages, :updated_at)
                ON CONFLICT (chat_id, bot_id)
                DO UPDATE SET 
                    messages = EXCLUDED.messages,
                    updated_at = EXCLUDED.updated_at
            """)
            
            db.execute(query, {
                "chat_id": chat_id,
                "bot_id": bot_id,
                "messages": json.dumps(messages_json),
                "updated_at": datetime.now(timezone.utc)
            })
            
            db.commit()
            logger.info(f"Saved chat history for chat_id={chat_id}, bot_id={bot_id}, messages_count={len(messages)}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving chat history for chat_id={chat_id}, bot_id={bot_id}: {str(e)}")
            db.rollback()
            return False
        finally:
            db.close()
    
    @staticmethod
    def add_message_to_history(chat_id: str, bot_id: str, role: str, content: str) -> bool:
        """
        Add a single message to existing chat history
        
        Args:
            chat_id: Telegram chat ID or user identifier
            bot_id: Bot ID from telegram_bot_configs
            role: Message role ("user" or "assistant")
            content: Message content
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Load existing history
            existing_messages = ChatHistoryService.load_chat_history(chat_id, bot_id)
            
            # Add new message
            new_message = ChatMessage(role=role, content=content)
            existing_messages.append(new_message)
            
            # Save updated history
            return ChatHistoryService.save_chat_history(chat_id, bot_id, existing_messages)
            
        except Exception as e:
            logger.error(f"Error adding message to history for chat_id={chat_id}, bot_id={bot_id}: {str(e)}")
            return False
    
    @staticmethod
    def clear_chat_history(chat_id: str, bot_id: str) -> bool:
        """
        Clear chat history for a specific chat_id and bot_id
        
        Args:
            chat_id: Telegram chat ID or user identifier
            bot_id: Bot ID from telegram_bot_configs
            
        Returns:
            True if successful, False otherwise
        """
        try:
            db = ChatHistoryService._get_db_session()
            
            query = text("""
                DELETE FROM chat_history 
                WHERE chat_id = :chat_id AND bot_id = :bot_id
            """)
            
            db.execute(query, {"chat_id": chat_id, "bot_id": bot_id})
            db.commit()
            
            logger.info(f"Cleared chat history for chat_id={chat_id}, bot_id={bot_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error clearing chat history for chat_id={chat_id}, bot_id={bot_id}: {str(e)}")
            db.rollback()
            return False
        finally:
            db.close()
    
    @staticmethod
    def get_chat_stats(chat_id: str, bot_id: str) -> Dict[str, Any]:
        """
        Get statistics about a chat history
        
        Args:
            chat_id: Telegram chat ID or user identifier
            bot_id: Bot ID from telegram_bot_configs
            
        Returns:
            Dictionary with chat statistics
        """
        try:
            messages = ChatHistoryService.load_chat_history(chat_id, bot_id)
            
            user_messages = [msg for msg in messages if msg.role == "user"]
            assistant_messages = [msg for msg in messages if msg.role == "assistant"]
            
            return {
                "total_messages": len(messages),
                "user_messages": len(user_messages),
                "assistant_messages": len(assistant_messages),
                "max_history_limit": MAX_CHAT_HISTORY,
                "history_full": len(messages) >= MAX_CHAT_HISTORY
            }
            
        except Exception as e:
            logger.error(f"Error getting chat stats for chat_id={chat_id}, bot_id={bot_id}: {str(e)}")
            return {
                "total_messages": 0,
                "user_messages": 0,
                "assistant_messages": 0,
                "max_history_limit": MAX_CHAT_HISTORY,
                "history_full": False,
                "error": str(e)
            }

# Utility functions for easy access
def load_history(chat_id: str, bot_id: str) -> List[ChatMessage]:
    """Convenience function to load chat history"""
    return ChatHistoryService.load_chat_history(chat_id, bot_id)

def save_history(chat_id: str, bot_id: str, messages: List[ChatMessage]) -> bool:
    """Convenience function to save chat history"""
    return ChatHistoryService.save_chat_history(chat_id, bot_id, messages)

def add_user_message(chat_id: str, bot_id: str, content: str) -> bool:
    """Convenience function to add user message"""
    return ChatHistoryService.add_message_to_history(chat_id, bot_id, "user", content)

def add_assistant_message(chat_id: str, bot_id: str, content: str) -> bool:
    """Convenience function to add assistant message"""
    return ChatHistoryService.add_message_to_history(chat_id, bot_id, "assistant", content)
