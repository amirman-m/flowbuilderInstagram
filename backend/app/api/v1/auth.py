from fastapi import APIRouter, Depends, HTTPException, status, Response, Header, Request
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...services.keycloak_service import keycloak_service
from ...services.redis_service import redis_service
from ...services.user_service import UserService
from ...models.user import User
from ...schemas.user import UserCreate, UserLogin, UserSession, AuthResponse, User as UserSchema
from ...utils.token_utils import token_service
from ...core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
# Dependency Injected Services
def get_user_service(db: Session = Depends(get_db)) -> UserService:
    return UserService(db)


# AuthService to handle register/login logic
class AuthService:
    def __init__(self, user_service: UserService):
        self.user_service = user_service

    async def register_user(self, user: UserCreate):
        existing_user = await self.user_service.get_user_by_email(user.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        keycloak_result = await keycloak_service.create_user_in_keycloak(
            email=user.email,
            password=user.password,
            first_name=user.name.split()[0],
            last_name=" ".join(user.name.split()[1:]) if len(user.name.split()) > 1 else ""
        )

        if not keycloak_result["success"]:
            raise HTTPException(status_code=400, detail=f"Keycloak error: {keycloak_result['error']}")

        db_user = await self.user_service.create_user(
            email=user.email,
            name=user.name,
            keycloak_id=keycloak_result["keycloak_id"]
        )
        await redis_service.store_user_backup(db_user.id, {
            "email": db_user.email,
            "keycloak_id": db_user.keycloak_id,
            "name": db_user.name
        })

        await redis_service.store_user_by_email_backup(db_user.email, {
            "id": db_user.id,
            "keycloak_id": db_user.keycloak_id,
            "name": db_user.name
        })

        logger.info(f"User registered successfully: {user.email}")
        return db_user

    async def login_user(self, user_credentials: UserLogin, response: Response):
        auth_result = await keycloak_service.authenticate_user(
            user_credentials.email, user_credentials.password
        )

        if not auth_result["success"]:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        user = await self.user_service.get_user_by_email(user_credentials.email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")

        # Store refresh token in Redis with 30-minute expiration (token rotation)
        await redis_service.store_refresh_token(
            user.id, 
            auth_result["refresh_token"], 
            settings.refresh_token_expire_minutes * 60  # 30 minutes in seconds
        )

        response.set_cookie(
            key="refresh_token",
            value=auth_result["refresh_token"],
            httponly=True,  # Prevents JavaScript access
            secure=settings.cookie_secure,  # HTTPS only in production
            samesite=settings.cookie_samesite,  # CSRF protection
            max_age=settings.refresh_token_expire_days * 24 * 60 * 60,  # 7 days
            path="/auth/refresh"  # Only sent to refresh endpoint
        )

        response.set_cookie(
            key="access_token",
            value=auth_result["access_token"],
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            max_age=settings.access_token_expire_minutes * 60,  # 15 minutes
            path="/"  # Sent to all endpoints
        )

        logger.info(f"User {user.email} logged in successfully with HttpOnly cookies")

        return AuthResponse(user=user, message="Login successful")


@router.post("/register", response_model=UserSchema)
async def register(
    user: UserCreate,
    user_service: UserService = Depends(get_user_service)
):
    try:
        auth_service = AuthService(user_service)
        db_user = await auth_service.register_user(user)
        logger.info(f"User registered: {user.email}")
        return db_user
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unhandled error during registration")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/login", response_model=AuthResponse)
async def login(
    user_credentials: UserLogin,
    response: Response,
    user_service: UserService = Depends(get_user_service)
):
    try:
        auth_service = AuthService(user_service)
        auth_response = await auth_service.login_user(user_credentials, response)
        logger.info(f"User logged in: {user_credentials.email}")
        return auth_response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unhandled error during login")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout user by clearing HttpOnly cookies and revoking tokens."""
    try:
        # Extract user_id from request (hybrid approach: cookies + Redis fallback)
        user_id = await token_service.get_user_id_from_request(request, redis_service)
        
        # Get access token from request for revocation
        access_token = token_service.extract_access_token_from_request(request)
        if not access_token:
            raise HTTPException(status_code=401, detail="Access token missing")
        
        # Get refresh token using hybrid approach
        refresh_token = await token_service.get_refresh_token_hybrid(request, user_id, redis_service)
        
        # Revoke access token
        if access_token:
            access_result = await keycloak_service.revoke_tokens(access_token)
            if not access_result["success"]:
                logger.warning(f"Access token revocation failed for user {user_id}: {access_result.get('error')}")
        
        # Revoke refresh token if we have it
        if refresh_token:
            refresh_result = await keycloak_service.revoke_tokens(refresh_token, "refresh_token")
            if not refresh_result["success"]:
                logger.warning(f"Refresh token revocation failed for user {user_id}: {refresh_result.get('error')}")
            
            # Call Keycloak's logout endpoint to end the session
            logout_result = await keycloak_service.logout_user(refresh_token)
            if not logout_result["success"]:
                logger.warning(f"Keycloak session logout failed for user {user_id}: {logout_result.get('error')}")
        else:
            logger.warning(f"No refresh token found for user {user_id}")
        
        # Delete refresh token from Redis
        try:
            deleted = await redis_service.delete_refresh_token(user_id)
            if deleted:
                logger.info(f"User {user_id} logged out and refresh token deleted from Redis")
            else:
                logger.warning(f"User {user_id} logout attempted but refresh token not found in Redis")
        except Exception as e:
            logger.error(f"Redis token deletion error: {str(e)}")
        
        # Clear HttpOnly cookies
        response.delete_cookie(key="access_token", path="/")
        response.delete_cookie(key="refresh_token", path="/auth/refresh")
        
        logger.info(f"User {user_id} successfully logged out with cookies cleared")
        return {"message": "Successfully logged out"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Logout error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during logout"
        )

@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(request: Request, response: Response, 
                       user_service: UserService = Depends(get_user_service)):
    """
    Refresh access token using HttpOnly cookies (hybrid approach with Redis fallback).
    """
    try:
        # Try to get access token from request to extract user_id
        access_token = token_service.extract_access_token_from_request(request)
        if not access_token:
            raise HTTPException(status_code=401, detail="Access token missing")
        
        # Decode access token to get user_id (with proper signature verification)
        user_id = await token_service.get_user_id_from_token(access_token)
        
        # Get refresh token using hybrid approach (cookie first, then Redis fallback)
        refresh_token = await token_service.get_refresh_token_hybrid(request, user_id, redis_service)
        
        if not refresh_token:
            logger.warning(f"No refresh token found for user {user_id}")
            raise HTTPException(status_code=401, detail="Refresh token not found")
        
        # Exchange refresh token for new tokens with Keycloak
        refresh_result = await keycloak_service.refresh_token(refresh_token)
        
        if not refresh_result.get("success"):
            logger.error(f"Token refresh failed for user {user_id}: {refresh_result.get('error')}")
            raise HTTPException(status_code=401, detail="Token refresh failed")
        
        # Extract new tokens
        new_access_token = refresh_result["access_token"]
        new_refresh_token = refresh_result.get("refresh_token", refresh_token)
        expires_in = refresh_result["expires_in"]
        
        # Token Rotation: Always update refresh token in Redis (hybrid approach)
        # Store new refresh token with 30-minute expiration for token rotation
        await redis_service.store_refresh_token(
            user_id, 
            new_refresh_token, 
            settings.refresh_token_expire_minutes * 60  # 30 minutes in seconds
        )
        logger.info(f"Token rotation: New refresh token stored in Redis for user {user_id} (30min expiry)")
        
        # Set new refresh token as HttpOnly cookie (30 minutes - token rotation)
        response.set_cookie(
            key="refresh_token",
            value=new_refresh_token,
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            max_age=settings.refresh_token_expire_minutes * 60,  # 30 minutes
            path="/auth/refresh"
        )
        
        # Set new access token as HttpOnly cookie (5 minutes - short-lived)
        response.set_cookie(
            key="access_token",
            value=new_access_token,
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            max_age=settings.access_token_expire_minutes * 60,  # 5 minutes
            path="/"
        )
        
        # Get user from database using keycloak_id
        user = await user_service.get_user_by_keycloak_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
        
        logger.info(f"Tokens refreshed successfully for user {user_id} with HttpOnly cookies")
        
        # Return user data without tokens (tokens are in secure cookies)
        return AuthResponse(user=user, message="Tokens refreshed successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Token refresh error")
        raise HTTPException(status_code=500, detail="Internal server error")
    
