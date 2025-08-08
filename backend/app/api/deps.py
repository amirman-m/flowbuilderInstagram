from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional
from ..core.database import get_db
from ..models.user import User
from ..utils.token_utils import token_service
from ..services.user_service import UserService
from ..services.keycloak_service import keycloak_service
from ..services.redis_service import redis_service
import logging
import time
import json

logger = logging.getLogger(__name__)


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """Get current user from HTTP-only cookies with JWT validation."""
    try:

        # Step 1: Extract access token from HTTP-only cookie
        access_token = token_service.extract_access_token_from_request(request)
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access token missing"
            )
        
        # Step 2: Validate JWT locally (signature, expiry, audience)
        user_id = await token_service.get_user_id_from_request(request, redis_service)
        
        # Step 3: Check if we need periodic Keycloak validation
        should_validate_with_keycloak = await _should_validate_with_keycloak(user_id, access_token)
        logger.info(f"periodic Keycloak validation {should_validate_with_keycloak} ")
        #Step 4:
        if should_validate_with_keycloak:
            # Validate with Keycloak for revocation/real-time status
            #keycloak_validation = await keycloak_service.validate_access_token(access_token)
            keycloak_validation = await keycloak_service.introspect_token(access_token)
            
            if not keycloak_validation.get("success"):
                logger.warning(f"Keycloak token validation failed for user {user_id}: {keycloak_validation.get('error')}")
                # Remove invalid token from Redis
                await redis_service.delete_access_token(user_id)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token validation failed"
                )
            logger.info(f"Keycloak token validation successful for user {user_id}")
            # Cache successful validation to avoid hitting Keycloak too frequently
            # Cache successful validation
            await redis_service.store_token_validation_cache(
                user_id, 
                {"keycloak_validated": True},
                300  # 5 minutes cache
            )
        else:
            # Step 4: Validate token exists in Redis (critical security check)
            is_valid_in_redis = await redis_service.validate_access_token(user_id, access_token)
            if not is_valid_in_redis:
                logger.info(f"Access token validated failed from Redis for user {user_id}")
                logger.warning(f"Access token not found in Redis for user {user_id} - possible token theft or expiry")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token not found or expired"
                )
            logger.info(f"Access token validated successfully from Redis for user {user_id}")

        # Step 5: Get user from database
        user_service = UserService(db=db)
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

#Helper functions for performance optimization
async def _should_validate_with_keycloak(user_id: str, access_token: str) -> bool:
    """
    Determine if we should validate with Keycloak based on:
    1. Time since last validation
    2. Token characteristics
    3. Environment settings
    """   
    validation_interval = 60  # 1 minute   
    try:
        # Check if we recently validated this token
        cache_key = f"token_validated:{user_id}"
        last_validated = await redis_service.redis_client.get(cache_key)
        logger.info(f"last_validated {last_validated}")
        
        if last_validated:
            cached_data = json.loads(last_validated)  # Parse JSON string
            last_validated_time = float(cached_data["timestamp"])  # Extract timestamp
            current_time = time.time()
            if current_time - last_validated_time < validation_interval:
                return False  # Skip Keycloak validation
        
        return True  # Need to validate with Keycloak    
    except Exception as e:
        logger.warning(f"Cache check failed, defaulting to Keycloak validation: {str(e)}")
        return True






