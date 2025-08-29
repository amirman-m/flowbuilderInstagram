from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
import logging

logger = logging.getLogger(__name__)

class BotValidationService:
    """Service for validating Telegram bot configurations"""
    
    @staticmethod
    def _get_db_session() -> Session:
        """Get database session"""
        return next(get_db())
    
    @staticmethod
    def is_bot_active(bot_id: str) -> bool:
        """
        Check if a bot exists and is active
        
        Args:
            bot_id: Bot ID to validate
            
        Returns:
            True if bot exists and is active, False otherwise
        """
        try:
            db = BotValidationService._get_db_session()
            
            query = text("""
                SELECT id, bot_username, is_active 
                FROM telegram_bot_configs 
                WHERE bot_id = :bot_id AND is_active = true
            """)
            
            result = db.execute(query, {"bot_id": bot_id}).fetchone()
            
            if result:
                logger.info(f"Bot {bot_id} is active (username: {result[1]})")
                return True
            else:
                logger.info(f"Bot {bot_id} not found or inactive")
                return False
                
        except Exception as e:
            logger.error(f"Error validating bot {bot_id}: {str(e)}")
            return False
        finally:
            db.close()
    
    @staticmethod
    def get_bot_info(bot_id: str) -> Optional[Dict[str, Any]]:
        """
        Get bot information if active
        
        Args:
            bot_id: Bot ID to get info for
            
        Returns:
            Dictionary with bot info or None if not found/inactive
        """
        try:
            db = BotValidationService._get_db_session()
            
            query = text("""
                SELECT id, user_id, bot_username, bot_id, is_active, created_at
                FROM telegram_bot_configs 
                WHERE bot_id = :bot_id AND is_active = true
            """)
            
            result = db.execute(query, {"bot_id": bot_id}).fetchone()
            
            if result:
                return {
                    "id": result[0],
                    "user_id": result[1],
                    "bot_username": result[2],
                    "bot_id": result[3],
                    "is_active": result[4],
                    "created_at": result[5]
                }
            
            return None
                
        except Exception as e:
            logger.error(f"Error getting bot info for {bot_id}: {str(e)}")
            return None
        finally:
            db.close()

# Convenience functions
def is_bot_active(bot_id: str) -> bool:
    """Check if bot is active"""
    return BotValidationService.is_bot_active(bot_id)

def get_bot_info(bot_id: str) -> Optional[Dict[str, Any]]:
    """Get bot information"""
    return BotValidationService.get_bot_info(bot_id)
