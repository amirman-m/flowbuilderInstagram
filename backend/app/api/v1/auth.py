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
from ...utils.rate_limiter import multi_layer_rate_limit, check_email_rate_limit, analyze_rate_limit_patterns
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
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
        keycloak_user_id = user.keycloak_id
        # Store refresh token in Redis with 30-minute expiration (token rotation)
        await redis_service.store_refresh_token(
            keycloak_user_id, 
            auth_result["refresh_token"], 
            settings.refresh_token_expire_minutes * 60  # 30 minutes in seconds
        )
        # Store new access token (5 minutes - short-lived)
        await redis_service.store_access_token(
            keycloak_user_id, 
            auth_result["access_token"], 
            settings.access_token_expire_minutes * 60
        )
        logger.info(f"Tokens stored in Redis for keycloak_user: {keycloak_user_id}")
        response.set_cookie(
            key="refresh_token",
            value=auth_result["refresh_token"],
            httponly=True,  # Prevents JavaScript access
            secure=settings.cookie_secure,  # HTTPS only in production
            samesite=settings.cookie_samesite,  # CSRF protection
            max_age=settings.refresh_token_expire_minutes * 60,  # 30 minutes
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
@multi_layer_rate_limit("registration", clear_on_success=False)
async def register(
    user: UserCreate,
    user_service: UserService = Depends(get_user_service)
):
    try:
        # Additional email-based rate limiting
        # 2 registration attempts per email per 30 minutes (stricter than IP)
        await check_email_rate_limit(user.email, max_attempts=3, window_seconds=1800)
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
@multi_layer_rate_limit("login", clear_on_success=True)
async def login(
    user_credentials: UserLogin,
    response: Response,
    user_service: UserService = Depends(get_user_service)
):
    try:
        # Additional email-based rate limiting for login attempts
        # 3 login attempts per email per 15 minutes
        await check_email_rate_limit(user_credentials.email, max_attempts=3, window_seconds=900)
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
        keycloak_user_id = await token_service.get_user_id_from_request(request, redis_service)
        
        # Get access token from request for revocation
        access_token = token_service.extract_access_token_from_request(request)
        if not access_token:
            raise HTTPException(status_code=401, detail="Access token missing")
        
        # Get refresh token using hybrid approach
        refresh_token = await token_service.get_refresh_token_hybrid(request, keycloak_user_id, redis_service)
        
        # Revoke tokens with Keycloak (parallel execution for better performance)
        import asyncio
        revocation_tasks = []
        
        if access_token:
            revocation_tasks.append(keycloak_service.revoke_tokens(access_token))
        if refresh_token:
            revocation_tasks.append(keycloak_service.revoke_tokens(refresh_token, "refresh_token"))
            revocation_tasks.append(keycloak_service.logout_user(refresh_token))

        # Execute all revocation tasks in parallel
        if revocation_tasks:
            revocation_results = await asyncio.gather(*revocation_tasks, return_exceptions=True)
            for i, result in enumerate(revocation_results):
                if isinstance(result, Exception):
                    logger.warning(f"Revocation task {i} failed: {str(result)}")
                elif not result.get("success"):
                    logger.warning(f"Revocation task {i} unsuccessful: {result.get('error')}")
        
        # Clean up all Redis tokens and cache
        cleanup_success = await redis_service.cleanup_user_tokens(keycloak_user_id)
        if cleanup_success:
            logger.info(f"All tokens cleaned up for user {keycloak_user_id}")
        else:
            logger.warning(f"Token cleanup may have been incomplete for user {keycloak_user_id}")
        
        # Clear HttpOnly cookies
        response.delete_cookie(key="access_token", path="/")
        response.delete_cookie(key="refresh_token", path="/auth/refresh")
        
        logger.info(f"User {keycloak_user_id} successfully logged out with complete token cleanup")
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
        # Get refresh token from HttpOnly cookie first
        refresh_token = token_service.extract_refresh_token_from_request(request)
        if not refresh_token:
            raise HTTPException(status_code=401, detail="Refresh token missing")

        # Validate refresh token with Keycloak first (security best practice)
        refresh_validation = await keycloak_service.validate_refresh_token(refresh_token)
        if not refresh_validation.get("success"):
            logger.warning(f"Refresh token validation failed with keycloak: {refresh_validation.get('error')}")
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        # Get user_id from validated refresh token
        keycloak_user_id = refresh_validation.get("user_id") or await token_service.get_user_id_from_refresh_token(refresh_token)
        
        # Exchange refresh token for new tokens with Keycloak
        refresh_result = await keycloak_service.refresh_token(refresh_token)
        
        if not refresh_result.get("success"):
            logger.error(f"Token refresh failed for user: {refresh_result.get('error')}")
            raise HTTPException(status_code=401, detail="Token refresh failed")
        
        # Extract new tokens
        new_access_token = refresh_result["access_token"]
        new_refresh_token = refresh_result.get("refresh_token", refresh_token)
        expires_in = refresh_result["expires_in"]
        
        # Token Rotation: Always update refresh token in Redis (hybrid approach)
        # Store new refresh token with 30-minute expiration for token rotation

        # Store both tokens in Redis with proper expiration
        token_storage_tasks = [
            # Store new refresh token (30 minutes for token rotation)
            redis_service.store_refresh_token(
                keycloak_user_id, 
                new_refresh_token, 
                settings.refresh_token_expire_minutes * 60 
            ),
            # Store new access token (5 minutes - short-lived)
            redis_service.store_access_token(
                keycloak_user_id, 
                new_access_token, 
                settings.access_token_expire_minutes * 60
            )
        ]
        
        # Execute Redis operations in parallel for better performance
        import asyncio
        await asyncio.gather(*token_storage_tasks)
        logger.info(f"Token rotation: New refresh token stored in Redis for user {keycloak_user_id} (30min expiry)")
        logger.info(f"Token rotation: New access token stored in Redis for user {keycloak_user_id} (5min expiry)")
        
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
        user = await user_service.get_user_by_keycloak_id(keycloak_user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
        
        logger.info(f"Tokens refreshed successfully for user {keycloak_user_id} with HttpOnly cookies")
        
        # Return user data without tokens (tokens are in secure cookies)
        return AuthResponse(user=user, message="Tokens refreshed successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Token refresh error")
        raise HTTPException(status_code=500, detail="Internal server error")
    
