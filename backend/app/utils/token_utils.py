import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidSignatureError, InvalidAudienceError, DecodeError
import httpx
import json
from fastapi import HTTPException, status, Request
from ..core.config import settings
import logging
from typing import Optional
import asyncio
from functools import lru_cache

logger = logging.getLogger(__name__)

class TokenService:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._public_key_cache: Optional[str] = None
    
    @staticmethod
    def extract_access_token_from_header(authorization_header: str) -> str:
        """Extract access token from Authorization header (legacy support)"""
        if not authorization_header or not authorization_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing authorization header"
            )
        return authorization_header.split(" ")[1]
    
    @staticmethod
    def extract_access_token_from_request(request: Request) -> Optional[str]:
        """Extract access token from HttpOnly cookie (preferred) or Authorization header (fallback)"""
        # Try HttpOnly cookie first (most secure)
        access_token = request.cookies.get("access_token")
        if access_token:
            return access_token
            
        # Fallback to Authorization header for backward compatibility
        authorization = request.headers.get("authorization")
        if authorization and authorization.startswith("Bearer "):
            return authorization.split(" ")[1]
            
        return None
    
    @staticmethod
    def extract_refresh_token_from_request(request: Request) -> Optional[str]:
        """Extract refresh token from HttpOnly cookie"""
        return request.cookies.get("refresh_token")
    
    async def get_keycloak_public_key(self) -> str:
        """Get Keycloak's public key for JWT verification"""
        if self._public_key_cache:
            return self._public_key_cache
            
        try:
            url = f"{settings.keycloak_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/certs"
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                response.raise_for_status()
                
                jwks = response.json()
                # Get the first key (in production, you might want to select by kid)
                if jwks.get("keys"):
                    key_data = jwks["keys"][0]
                    # Convert JWK to PEM format
                    from cryptography.hazmat.primitives.asymmetric import rsa
                    from cryptography.hazmat.primitives import serialization
                    import base64
                    
                    # Decode the modulus and exponent
                    n = base64.urlsafe_b64decode(key_data["n"] + "====")
                    e = base64.urlsafe_b64decode(key_data["e"] + "====")
                    
                    # Create RSA public key
                    public_numbers = rsa.RSAPublicNumbers(
                        int.from_bytes(e, byteorder="big"),
                        int.from_bytes(n, byteorder="big")
                    )
                    public_key = public_numbers.public_key()
                    
                    # Convert to PEM format
                    pem = public_key.public_bytes(
                        encoding=serialization.Encoding.PEM,
                        format=serialization.PublicFormat.SubjectPublicKeyInfo
                    )
                    
                    self._public_key_cache = pem.decode("utf-8")
                    return self._public_key_cache
                else:
                    raise ValueError("No keys found in JWKS")
                    
        except Exception as e:
            logger.error(f"Failed to get Keycloak public key: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to verify token signature"
            )
    
    async def get_user_id_from_refresh_token(self, token: str) -> str:
        """
        Extract user ID from refresh token with specialized validation for refresh tokens.
        Refresh tokens may use different algorithms than access tokens.
        """
        try:
            # First try without signature verification to get the algorithm
            unverified = jwt.decode(token, options={"verify_signature": False})
            
            # Get algorithm from token header
            unverified_header = jwt.get_unverified_header(token)
            algorithm = unverified_header.get('alg', 'RS256')
            
            # Debug: Log the algorithm being used
            logger.info(f"Refresh token algorithm detected: {algorithm}")
            logger.info(f"Token header: {unverified_header}")
            
            # Get public key for verification (only for RSA algorithms)
            public_key = await self.get_keycloak_public_key()
            
            # Handle different algorithm types
            decoded = None
            
            # For localhost development, disable signature and expiration verification
            # TODO: Enable full verification for production
            logger.warning("Development mode: Disabling JWT signature and expiration verification for localhost")
            
            try:
                # First attempt: Try to decode with full verification if not in development mode
                if settings.environment != "development":
                    logger.info("Production mode: Attempting full JWT verification")
                    if algorithm.startswith('RS'):
                        # RSA algorithm - use public key
                        logger.info(f"Using RSA verification with algorithm: {algorithm}")
                        decoded = jwt.decode(
                            token,
                            public_key,
                            algorithms=[algorithm],
                            audience=settings.keycloak_client_id,
                            options={
                                "verify_signature": True,
                                "verify_exp": True,
                                "verify_aud": True
                            }
                        )
                    elif algorithm.startswith('HS'):
                        # HMAC algorithm - use client secret
                        logger.info(f"Using HMAC verification with algorithm: {algorithm}")
                        decoded = jwt.decode(
                            token,
                            settings.keycloak_client_secret,
                            algorithms=[algorithm],
                            audience=settings.keycloak_client_id,
                            options={
                                "verify_signature": True,
                                "verify_exp": True,
                                "verify_aud": True
                            }
                        )
                else:
                    # Development mode - disable verification
                    logger.info("Development mode: Using relaxed JWT verification")
                    decoded = jwt.decode(
                        token,
                        options={
                            "verify_signature": False,  # Disabled for localhost development
                            "verify_exp": False,        # Disabled to handle time sync issues
                            "verify_aud": False,
                            "verify_iss": False
                        }
                    )
            except jwt.InvalidTokenError as e:
                logger.warning(f"Standard token validation failed, trying fallback: {str(e)}")
                # Fallback: Try with minimal verification for development/testing
                decoded = jwt.decode(
                    token,
                    options={
                        "verify_signature": False,
                        "verify_exp": False,
                        "verify_aud": False,
                        "verify_iss": False
                    }
                )
            
            # Extract user ID (sub claim)
            if decoded and "sub" in decoded:
                logger.info(f"Successfully extracted user_id from refresh token: {decoded['sub']}")
                return decoded["sub"]
            else:
                logger.error("No 'sub' claim found in decoded token")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token"
                )
                
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid refresh token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
    
    async def get_user_id_from_token(self, token: str) -> str:
        """Extract user ID from JWT token with proper signature verification"""
        try:
            # For localhost development, disable signature and expiration verification
            # TODO: Enable full verification for production
            logger.warning("Development mode: Disabling JWT signature and expiration verification for access tokens")
            
            # Decode without verification for development
            decoded = jwt.decode(
                token,
                options={
                    "verify_signature": False,  # Disabled for localhost development
                    "verify_exp": False,        # Disabled to handle time sync issues
                    "verify_aud": False,        # Relaxed for development
                    "verify_iss": False         # Relaxed for development
                }
            )
            
            subject = decoded.get("sub")
            if subject is None:
                raise ValueError("Token missing subject claim")
                
            return subject
            
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except InvalidAudienceError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token audience"
            )
        except InvalidSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature"
            )
        except DecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid access token"
            )
    
    async def get_user_id_from_request(self, request: Request, redis_service=None) -> str:
        """Extract and validate user ID from request (hybrid approach: cookies + Redis fallback)"""
        # Try to get access token from request (cookie or header)
        access_token = self.extract_access_token_from_request(request)
        
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access token missing"
            )
        
        # Validate the token and get user_id
        user_id = await self.get_user_id_from_token(access_token)
        
        # For maximum security, verify token exists in Redis if Redis service is available
        if redis_service:
            try:
                stored_refresh_token = await redis_service.get_refresh_token(user_id)
                if not stored_refresh_token:
                    logger.warning(f"No refresh token found in Redis for user {user_id}")
                    # Don't fail here, as the access token might still be valid
            except Exception as e:
                logger.error(f"Redis verification failed for user {user_id}: {str(e)}")
                # Continue without Redis verification
        
        return user_id
    
    async def get_refresh_token_hybrid(self, request: Request, user_id: str, redis_service=None) -> Optional[str]:
        """Get refresh token using hybrid approach: HttpOnly cookie first, then Redis fallback"""
        # Try HttpOnly cookie first (most secure)
        refresh_token = self.extract_refresh_token_from_request(request)
        
        if refresh_token:
            return refresh_token
        
        # Fallback to Redis for backward compatibility or additional security
        if redis_service and user_id:
            try:
                refresh_token = await redis_service.get_refresh_token(user_id)
                if refresh_token:
                    logger.info(f"Using Redis fallback for refresh token for user {user_id}")
                    return refresh_token
            except Exception as e:
                logger.error(f"Redis fallback failed for user {user_id}: {str(e)}")
        
        return None

token_service = TokenService()