"""
Flow-specific Telegram bot settings API endpoints
Handles token management at the flow level
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.services.telegram_bot_service import TelegramBotService
from app.models.telegram_bot import TelegramBotConfig

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/flows", tags=["flow-telegram-settings"])


class FlowTelegramSettingsRequest(BaseModel):
    """Request model for flow-specific Telegram settings"""
    access_token: str
    config_name: Optional[str] = "telegram"


class FlowTelegramSettingsResponse(BaseModel):
    """Response model for flow-specific Telegram settings"""
    success: bool
    message: str
    config_data: Optional[Dict[str, Any]] = None


class FlowTelegramStatusResponse(BaseModel):
    """Response model for flow Telegram status check"""
    has_telegram_config: bool
    config_data: Optional[Dict[str, Any]] = None
    message: str


@router.post("/{flow_id}/telegram-settings", response_model=FlowTelegramSettingsResponse)
async def set_flow_telegram_settings(
    flow_id: int,
    request: FlowTelegramSettingsRequest,
    db: Session = Depends(get_db)
):
    """
    Set Telegram bot configuration for a specific flow
    This replaces the token setup functionality from TelegramInputNode
    """
    try:
        # TODO: Get user_id from authentication context
        user_id = 1  # Placeholder - should come from auth
        
        bot_service = TelegramBotService()
        
        # Validate and setup bot with flow-specific context
        success, message, config_data = await bot_service.validate_and_setup_bot(
            db=db,
            user_id=user_id,
            access_token=request.access_token,
            flow_id=flow_id,
            node_id="telegram_input",  # Default node_id for flow-level config
            config_name=request.config_name
        )
        
        if success:
            logger.info(f"Flow {flow_id} Telegram settings configured successfully")
            return FlowTelegramSettingsResponse(
                success=True,
                message=message,
                config_data=config_data
            )
        else:
            logger.warning(f"Flow {flow_id} Telegram settings failed: {message}")
            raise HTTPException(status_code=400, detail=message)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting flow Telegram settings: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{flow_id}/telegram-settings", response_model=FlowTelegramStatusResponse)
async def get_flow_telegram_settings(
    flow_id: int,
    db: Session = Depends(get_db)
):
    """
    Get current Telegram bot configuration for a specific flow
    Used by TelegramInputNode to check if token is already configured
    """
    try:
        # TODO: Get user_id from authentication context
        user_id = 1  # Placeholder - should come from auth
        
        # Look for active bot config for this user and flow
        bot_config = db.query(TelegramBotConfig).filter(
            TelegramBotConfig.user_id == user_id,
            TelegramBotConfig.default_flow_id == flow_id,
            TelegramBotConfig.is_active == True
        ).first()
        
        if bot_config and bot_config.webhook_url:
            config_data = {
                "bot_id": bot_config.bot_id,
                "bot_username": bot_config.bot_username,
                "webhook_url": bot_config.webhook_url,
                "config_name": bot_config.config_name,
                "status": "configured"
            }
            
            return FlowTelegramStatusResponse(
                has_telegram_config=True,
                config_data=config_data,
                message="Telegram bot is configured for this flow"
            )
        else:
            return FlowTelegramStatusResponse(
                has_telegram_config=False,
                config_data=None,
                message="No Telegram bot configured for this flow"
            )
            
    except Exception as e:
        logger.error(f"Error getting flow Telegram settings: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{flow_id}/telegram-settings")
async def delete_flow_telegram_settings(
    flow_id: int,
    db: Session = Depends(get_db)
):
    """
    Remove Telegram bot configuration for a specific flow
    """
    try:
        # TODO: Get user_id from authentication context
        user_id = 1  # Placeholder - should come from auth
        
        # Find and deactivate bot config for this flow
        bot_config = db.query(TelegramBotConfig).filter(
            TelegramBotConfig.user_id == user_id,
            TelegramBotConfig.default_flow_id == flow_id,
            TelegramBotConfig.is_active == True
        ).first()
        
        if bot_config:
            bot_config.is_active = False
            db.commit()
            
            return {"success": True, "message": "Telegram configuration removed from flow"}
        else:
            return {"success": False, "message": "No Telegram configuration found for this flow"}
            
    except Exception as e:
        logger.error(f"Error deleting flow Telegram settings: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
