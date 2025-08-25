"""
Database models for Telegram bot configurations
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from ..core.database import Base


class TelegramBotConfig(Base):
    """
    Store Telegram bot configurations per user
    """
    __tablename__ = "telegram_bot_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    access_token = Column(String(255), nullable=False)
    webhook_url = Column(Text, nullable=True)
    bot_username = Column(String(100), nullable=True)
    bot_id = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_validated_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<TelegramBotConfig(user_id={self.user_id}, bot_username={self.bot_username})>"
