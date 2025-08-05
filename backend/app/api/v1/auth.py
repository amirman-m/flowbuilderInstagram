from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...services.keycloak_service import keycloak_service
from ...services.redis_service import redis_service
from ...services.user_service import UserService
from ...models.user import User
from ...schemas.user import UserCreate, UserLogin, UserSession, User as UserSchema
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/register", response_model=UserSchema)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user via Keycloak."""
    try:
        user_service = UserService(db)
        
        # Check if user already exists in our system
        existing_user = await user_service.get_user_by_email(user.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create user in Keycloak
        keycloak_result = await keycloak_service.create_user_in_keycloak(
            email=user.email,
            password=user.password,
            first_name=user.name.split()[0] if user.name else "",
            last_name=" ".join(user.name.split()[1:]) if len(user.name.split()) > 1 else ""
        )
        
        if not keycloak_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Registration failed: {keycloak_result['error']}"
            )
        
        # Create user in our database with Keycloak ID
        db_user = await user_service.create_user(
            email=user.email,
            name=user.name,
            keycloak_id=keycloak_result["keycloak_id"]
        )
        
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user in database"
            )
        
        logger.info(f"User registered successfully: {user.email}")
        return db_user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during registration"
        )


@router.post("/login")
async def login(user_credentials: UserLogin, response: Response, db: Session = Depends(get_db)):
    """Login user via Keycloak with secure HttpOnly cookies."""
    try:
        user_service = UserService(db)
        # Authenticate with Keycloak
        auth_result = await keycloak_service.authenticate_user(
            email=user_credentials.email,
            password=user_credentials.password
        )
        
        if not auth_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        # Get user from our database
        user = await user_service.get_user_by_email(user_credentials.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in database"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        # Store refresh token securely in Redis
        refresh_token = auth_result["refresh_token"]
        await redis_service.store_refresh_token(user.id, refresh_token)
        
        # Set access token in HttpOnly cookie
        response.set_cookie(
            key="access_token",
            value=auth_result["access_token"],
            httponly=True,  # Cannot be accessed by JavaScript
            secure=False,   # Set to True in production with HTTPS
            samesite="lax", # CSRF protection
            max_age=auth_result.get("expires_in", 300)  # Token expiry time
        )
        
        # Set refresh token in HttpOnly cookie (for token refresh)
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=False,   # Set to True in production
            samesite="lax",
            max_age=86400   # 24 hours
        )
        
        # Return only user data (no tokens in response)
        logger.info(f"User logged in successfully: {user.email}")
        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "is_active": user.is_active,
                "created_at": user.created_at,
                "updated_at": user.updated_at
            },
            "message": "Login successful"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )


@router.post("/logout")
async def logout(response: Response, db: Session = Depends(get_db)):
    """Logout user by clearing HttpOnly cookies and tokens."""
    try:
        # Clear access token cookie
        response.set_cookie(
            key="access_token",
            value="",
            httponly=True,
            secure=False,   # Set to True in production
            samesite="lax",
            max_age=0       # Expire immediately
        )
        
        # Clear refresh token cookie
        response.set_cookie(
            key="refresh_token",
            value="",
            httponly=True,
            secure=False,   # Set to True in production
            samesite="lax",
            max_age=0       # Expire immediately
        )
        
        # TODO: In a full implementation, you would:
        # 1. Get user ID from the access token
        # 2. Delete refresh token from Redis
        # 3. Optionally invalidate the token in Keycloak
        
        logger.info("User logged out successfully")
        return {"message": "Successfully logged out"}
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return {"message": "Logout completed with warnings"}
