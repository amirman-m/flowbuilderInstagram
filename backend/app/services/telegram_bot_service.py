"""
Telegram Bot Service - SOLID principles implementation
Handles bot validation, webhook management, and configuration
"""
import httpx
import logging
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.telegram_bot import TelegramBotConfig
from app.core.config import settings

logger = logging.getLogger(__name__)


class TelegramBotValidator:
    """
    Single Responsibility: Validate Telegram bot tokens
    """
    
    @staticmethod
    async def validate_bot_token(access_token: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Validate bot token by calling Telegram's getMe API
        
        Returns:
            Tuple[bool, Optional[Dict]]: (is_valid, bot_info)
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.telegram.org/bot{access_token}/getMe",
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        return True, data.get("result")
                    else:
                        logger.warning(f"Bot validation failed: {data.get('description')}")
                        return False, None
                else:
                    logger.error(f"HTTP error validating bot: {response.status_code}")
                    return False, None
                    
        except Exception as e:
            logger.error(f"Exception validating bot token: {e}")
            return False, None


class TelegramWebhookManager:
    """
    Single Responsibility: Manage Telegram webhooks
    """
    
    @staticmethod
    async def get_webhook_info(access_token: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Get current webhook information
        
        Returns:
            Tuple[bool, Optional[Dict]]: (success, webhook_info)
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.telegram.org/bot{access_token}/getWebhookInfo",
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        return True, data.get("result")
                    else:
                        logger.warning(f"Get webhook info failed: {data.get('description')}")
                        return False, None
                else:
                    logger.error(f"HTTP error getting webhook info: {response.status_code}")
                    return False, None
                    
        except Exception as e:
            logger.error(f"Exception getting webhook info: {e}")
            return False, None
    
    @staticmethod
    async def set_webhook(access_token: str, webhook_url: str) -> Tuple[bool, Optional[str]]:
        """
        Set webhook for the bot
        
        Returns:
            Tuple[bool, Optional[str]]: (success, error_message)
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://api.telegram.org/bot{access_token}/setWebhook",
                    json={
                        "url": webhook_url,
                        "allowed_updates": ["message"]
                    },
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        logger.info(f"Webhook set successfully: {webhook_url}")
                        return True, None
                    else:
                        error_msg = data.get("description", "Unknown error")
                        logger.error(f"Set webhook failed: {error_msg}")
                        return False, error_msg
                else:
                    error_msg = f"HTTP error: {response.status_code}"
                    logger.error(f"HTTP error setting webhook: {response.status_code}")
                    return False, error_msg
                    
        except Exception as e:
            error_msg = f"Exception: {str(e)}"
            logger.error(f"Exception setting webhook: {e}")
            return False, error_msg
    
    @staticmethod
    async def delete_webhook(access_token: str) -> Tuple[bool, Optional[str]]:
        """
        Delete current webhook
        
        Returns:
            Tuple[bool, Optional[str]]: (success, error_message)
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://api.telegram.org/bot{access_token}/deleteWebhook",
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        logger.info("Webhook deleted successfully")
                        return True, None
                    else:
                        error_msg = data.get("description", "Unknown error")
                        logger.error(f"Delete webhook failed: {error_msg}")
                        return False, error_msg
                else:
                    error_msg = f"HTTP error: {response.status_code}"
                    logger.error(f"HTTP error deleting webhook: {response.status_code}")
                    return False, error_msg
                    
        except Exception as e:
            error_msg = f"Exception: {str(e)}"
            logger.error(f"Exception deleting webhook: {e}")
            return False, error_msg


class TelegramBotConfigRepository:
    """
    Single Responsibility: Database operations for bot configurations
    """
    
    @staticmethod
    def get_bot_config(db: Session, user_id: int, access_token: str) -> Optional[TelegramBotConfig]:
        """Get bot configuration by user_id and access_token"""
        return db.query(TelegramBotConfig).filter(
            TelegramBotConfig.user_id == user_id,
            TelegramBotConfig.access_token == access_token,
            TelegramBotConfig.is_active == True
        ).first()
    
    @staticmethod
    def create_or_update_bot_config(
        db: Session,
        user_id: int,
        access_token: str,
        bot_info: Dict[str, Any],
        webhook_url: Optional[str] = None
    ) -> TelegramBotConfig:
        """Create or update bot configuration"""
        existing = TelegramBotConfigRepository.get_bot_config(db, user_id, access_token)
        
        if existing:
            # Update existing
            existing.webhook_url = webhook_url
            existing.bot_username = bot_info.get("username")
            existing.bot_id = str(bot_info.get("id"))
            existing.last_validated_at = datetime.utcnow()
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing
        else:
            # Create new
            bot_config = TelegramBotConfig(
                user_id=user_id,
                access_token=access_token,
                webhook_url=webhook_url,
                bot_username=bot_info.get("username"),
                bot_id=str(bot_info.get("id")),
                last_validated_at=datetime.utcnow()
            )
            db.add(bot_config)
            db.commit()
            db.refresh(bot_config)
            return bot_config
    
    @staticmethod
    def deactivate_bot_config(db: Session, user_id: int, access_token: str) -> bool:
        """Deactivate bot configuration"""
        bot_config = TelegramBotConfigRepository.get_bot_config(db, user_id, access_token)
        if bot_config:
            bot_config.is_active = False
            bot_config.updated_at = datetime.utcnow()
            db.commit()
            return True
        return False


class TelegramBotService:
    """
    Main service orchestrating bot operations
    Open/Closed Principle: Easy to extend with new bot operations
    """
    
    def __init__(self):
        self.validator = TelegramBotValidator()
        self.webhook_manager = TelegramWebhookManager()
        self.repository = TelegramBotConfigRepository()
    
    def generate_webhook_url(self, user_id: int, flow_id: int, node_id: str) -> str:
        """Generate webhook URL based on user, flow, and node"""
        base_url = getattr(settings, 'WEBHOOK_BASE_URL', 'https://asangram.tech')
        return f"{base_url}/api/telegram/webhook/{user_id}/{flow_id}/{node_id}"
    
    async def validate_and_setup_bot(
        self,
        db: Session,
        user_id: int,
        access_token: str,
        flow_id: int,
        node_id: str
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """
        Complete bot validation and setup process
        
        Returns:
            Tuple[bool, str, Optional[Dict]]: (success, message, bot_config_data)
        """
        # Step 1: Validate bot token
        is_valid, bot_info = await self.validator.validate_bot_token(access_token)
        if not is_valid:
            return False, "Invalid bot token. Please check your token from @BotFather.", None
        
        # Step 2: Check current webhook status
        webhook_success, webhook_info = await self.webhook_manager.get_webhook_info(access_token)
        if not webhook_success:
            return False, "Failed to get webhook information from Telegram.", None
        
        # Step 3: Generate expected webhook URL
        expected_webhook_url = self.generate_webhook_url(user_id, flow_id, node_id)
        current_webhook_url = webhook_info.get("url", "")
        
        # Step 4: Handle webhook configuration
        webhook_needs_update = False
        if not current_webhook_url:
            # No webhook set
            webhook_needs_update = True
            logger.info("No webhook configured, setting new webhook")
        elif current_webhook_url != expected_webhook_url:
            # Different webhook URL, need to update
            webhook_needs_update = True
            logger.info(f"Webhook URL mismatch. Current: {current_webhook_url}, Expected: {expected_webhook_url}")
            
            # Delete existing webhook first
            delete_success, delete_error = await self.webhook_manager.delete_webhook(access_token)
            if not delete_success:
                return False, f"Failed to delete existing webhook: {delete_error}", None
        
        # Step 5: Set webhook if needed
        if webhook_needs_update:
            set_success, set_error = await self.webhook_manager.set_webhook(access_token, expected_webhook_url)
            if not set_success:
                return False, f"Failed to set webhook: {set_error}", None
        
        # Step 6: Save/update configuration in database
        try:
            bot_config = self.repository.create_or_update_bot_config(
                db=db,
                user_id=user_id,
                access_token=access_token,
                bot_info=bot_info,
                webhook_url=expected_webhook_url
            )
            
            config_data = {
                "bot_id": bot_config.bot_id,
                "bot_username": bot_config.bot_username,
                "webhook_url": bot_config.webhook_url,
                "status": "configured"
            }
            
            return True, "Bot configured successfully. Ready to receive messages.", config_data
            
        except Exception as e:
            logger.error(f"Database error saving bot config: {e}")
            return False, f"Failed to save bot configuration: {str(e)}", None
    
    async def validate_bot_only(
        self,
        access_token: str
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """
        Validate bot token only (for settings validation)
        
        Returns:
            Tuple[bool, str, Optional[Dict]]: (success, message, bot_info)
        """
        is_valid, bot_info = await self.validator.validate_bot_token(access_token)
        
        if is_valid:
            return True, f"Valid bot: @{bot_info.get('username', 'unknown')}", bot_info
        else:
            return False, "Invalid bot token. Please check your token from @BotFather.", None
