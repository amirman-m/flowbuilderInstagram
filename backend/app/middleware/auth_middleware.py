from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import jwt
import logging

logger = logging.getLogger(__name__)

class CookieBearer(HTTPBearer):
    """Custom authentication class that extracts JWT from HttpOnly cookies"""
    
    def __init__(self, auto_error: bool = True):
        super(CookieBearer, self).__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        # First try to get token from Authorization header (for API clients)
        authorization: str = request.headers.get("Authorization")
        if authorization:
            scheme, credentials = authorization.split()
            if scheme.lower() == "bearer":
                return HTTPAuthorizationCredentials(scheme=scheme, credentials=credentials)
        
        # If no Authorization header, try to get from HttpOnly cookie
        access_token = request.cookies.get("access_token")
        if access_token:
            return HTTPAuthorizationCredentials(scheme="Bearer", credentials=access_token)
        
        if self.auto_error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return None

# Create instance to use in dependencies
cookie_bearer = CookieBearer()

def get_current_user_from_token(token: str) -> dict:
    """Extract user information from JWT token without verification (for demo)"""
    try:
        # In production, you should verify the token with Keycloak's public key
        # For now, we'll just decode without verification
        payload = jwt.decode(token, options={"verify_signature": False})
        return {
            "sub": payload.get("sub"),
            "email": payload.get("email"),
            "name": payload.get("name"),
            "preferred_username": payload.get("preferred_username")
        }
    except Exception as e:
        logger.error(f"Error decoding token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

async def get_current_user(credentials: HTTPAuthorizationCredentials = cookie_bearer):
    """Dependency to get current user from token (cookie or header)"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    return get_current_user_from_token(credentials.credentials)
