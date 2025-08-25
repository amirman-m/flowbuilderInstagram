"""
API endpoints for Telegram bot management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.core.database import get_db
from app.services.telegram_bot_service import TelegramBotService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class BotValidationRequest(BaseModel):
    access_token: str


class BotValidationResponse(BaseModel):
    success: bool
    message: str
    bot_info: Optional[Dict[str, Any]] = None


class BotSetupRequest(BaseModel):
    access_token: str
    flow_id: int
    node_id: str


class BotSetupResponse(BaseModel):
    success: bool
    message: str
    config_data: Optional[Dict[str, Any]] = None


@router.post("/validate", response_model=BotValidationResponse)
async def validate_bot_token(
    request: BotValidationRequest,
    db: Session = Depends(get_db)
):
    """
    Validate Telegram bot token only (for settings validation)
    """
    try:
        bot_service = TelegramBotService()
        success, message, bot_info = await bot_service.validate_bot_only(request.access_token)
        
        return BotValidationResponse(
            success=success,
            message=message,
            bot_info=bot_info
        )
        
    except Exception as e:
        logger.error(f"Error validating bot token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate bot token: {str(e)}"
        )


@router.post("/setup", response_model=BotSetupResponse)
async def setup_bot_webhook(
    request: BotSetupRequest,
    db: Session = Depends(get_db)
):
    """
    Complete bot validation and webhook setup
    """
    try:
        bot_service = TelegramBotService()
        
        # TODO: Get actual user_id from authentication context
        user_id = 1  # Placeholder
        
        success, message, config_data = await bot_service.validate_and_setup_bot(
            db=db,
            user_id=user_id,
            access_token=request.access_token,
            flow_id=request.flow_id,
            node_id=request.node_id
        )
        
        return BotSetupResponse(
            success=success,
            message=message,
            config_data=config_data
        )
        
    except Exception as e:
        logger.error(f"Error setting up bot: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to setup bot: {str(e)}"
        )
