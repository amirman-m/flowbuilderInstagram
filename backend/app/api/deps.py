from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional
from ..core.database import get_db
from ..models.user import User
from ..utils.token_utils import token_service
from ..services.user_service import UserService
from ..services.redis_service import redis_service
import logging

logger = logging.getLogger(__name__)


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """Get current user from HTTP-only cookies with JWT validation."""
    try:
        # Extract and validate user ID from access token (HTTP-only cookie or header)
        user_id = await token_service.get_user_id_from_request(request, redis_service)
        
        # Get user from database using Keycloak ID
        user_service = UserService(db)
        user = await user_service.get_user_by_keycloak_id(user_id)
        
        if not user:
            logger.warning(f"User not found for keycloak_id: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        return user
        
    except HTTPException:
        # Re-raise HTTP exceptions (these already have proper status codes)
        raise
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user."""
    if not current_user.is_active:
        logger.warning(f"Inactive user attempted access: {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user
