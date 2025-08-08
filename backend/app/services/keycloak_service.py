import httpx
import json
from typing import Dict, Any, Optional
from ..core.config import settings
import logging
import jwt
logger = logging.getLogger(__name__)

class KeycloakService:
    def __init__(self):
        self.keycloak_url = settings.keycloak_url
        self.realm = settings.keycloak_realm
        self.client_id = settings.keycloak_client_id
        self.client_secret = settings.keycloak_client_secret
        
    async def get_admin_token(self) -> str:
        """Get admin token for Keycloak operations"""
        url = f"{self.keycloak_url}/realms/master/protocol/openid-connect/token"
        
        data = {
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": settings.keycloak_admin_username,
            "password": settings.keycloak_admin_password
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, data=data)
            response.raise_for_status()
            return response.json()["access_token"]
    
    async def create_user_in_keycloak(self, email: str, password: str, first_name: str, last_name: str) -> Dict[str, Any]:
        """Create a new user in Keycloak"""
        try:
            admin_token = await self.get_admin_token()
            
            # Create user
            url = f"{self.keycloak_url}/admin/realms/{self.realm}/users"
            headers = {
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            }
            
            user_data = {
                "username": email,
                "email": email,
                "firstName": first_name,
                "lastName": last_name,
                "enabled": True,
                "emailVerified": True,
                "credentials": [{
                    "type": "password",
                    "value": password,
                    "temporary": False
                }]
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=user_data)
                
                if response.status_code == 201:
                    # Get user ID from location header
                    location = response.headers.get("Location")
                    user_id = location.split("/")[-1] if location else None
                    
                    logger.info(f"User created in Keycloak with ID: {user_id}")
                    return {"success": True, "keycloak_id": user_id}
                elif response.status_code == 409:
                    return {"success": False, "error": "User already exists"}
                else:
                    logger.error(f"Failed to create user in Keycloak: {response.text}")
                    return {"success": False, "error": "Failed to create user"}
                    
        except Exception as e:
            logger.error(f"Error creating user in Keycloak: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def authenticate_user(self, email: str, password: str) -> Dict[str, Any]:
        """Authenticate user with Keycloak and get tokens"""
        try:
            url = f"{self.keycloak_url}/realms/{self.realm}/protocol/openid-connect/token"
            
            data = {
                "grant_type": "password",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "username": email,
                "password": password
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=data)
                
                if response.status_code == 200:
                    tokens = response.json()
                    logger.info(f"User authenticated successfully: {email}")
                    return {
                        "success": True,
                        "access_token": tokens["access_token"],
                        "refresh_token": tokens["refresh_token"],
                        "expires_in": tokens["expires_in"]
                    }
                elif response.status_code == 401:
                    return {"success": False, "error": "Invalid credentials"}
                else:
                    logger.error(f"Authentication failed: {response.text}")
                    return {"success": False, "error": "Authentication failed"}
                    
        except Exception as e:
            logger.error(f"Error authenticating user: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh access token using refresh token"""
        try:
            url = f"{self.keycloak_url}/realms/{self.realm}/protocol/openid-connect/token"
            
            # Log the refresh token attempt (first/last 10 chars only for security)
            token_preview = f"{refresh_token[:10]}...{refresh_token[-10:]}" if len(refresh_token) > 20 else "[token too short]"
            logger.info(f"Attempting to refresh token: {token_preview}")
            
            data = {
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": refresh_token
            }
            
            # Log request details (excluding the full token)
            logger.info(f"Refresh token request to: {url}")
            logger.info(f"With client_id: {self.client_id}")
            logger.info(f"Client secret used: {'*' * 8}")
            
            async with httpx.AsyncClient() as client:
                # Send request and capture full response
                response = await client.post(url, data=data)
                
                # Log response details
                logger.info(f"Keycloak refresh response status: {response.status_code}")
                logger.info(f"Keycloak refresh response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    tokens = response.json()
                    logger.info("Token refresh successful")
                    return {
                        "success": True,
                        "access_token": tokens["access_token"],
                        "refresh_token": tokens.get("refresh_token", refresh_token),
                        "expires_in": tokens["expires_in"]
                    }
                else:
                    # Log error response
                    error_content = response.text
                    logger.error(f"Token refresh failed with status {response.status_code}: {error_content}")
                    return {"success": False, "error": f"Token refresh failed: {error_content}"}
                    
        except Exception as e:
            logger.exception(f"Error refreshing token: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information from Keycloak using access token"""
        try:
            url = f"{self.keycloak_url}/realms/{self.realm}/protocol/openid-connect/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code == 200:
                    return {"success": True, "user_info": response.json()}
                else:
                    return {"success": False, "error": "Failed to get user info"}
                    
        except Exception as e:
            logger.error(f"Error getting user info: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def revoke_tokens(self, token: str, token_type_hint: str = "access_token") -> Dict[str, Any]:
        """Revoke access or refresh token using Keycloak's revocation endpoint"""
        try:
            url = f"{self.keycloak_url}/realms/{self.realm}/protocol/openid-connect/revoke"
            data = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "token": token,
                "token_type_hint": token_type_hint
            }
        
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=data)
            
                if response.status_code == 200:
                    return {"success": True, "message": "Token successfully revoked"}
                else:
                    logger.error(f"Token revocation failed: {response.text}")
                    return {"success": False, "error": "Token revocation failed"}
                
        except Exception as e:
            logger.error(f"Error revoking token: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def logout_user(self, refresh_token: str) -> Dict[str, Any]:
        """Logout user by ending the session in Keycloak"""
        try:
            url = f"{self.keycloak_url}/realms/{self.realm}/protocol/openid-connect/logout"
            data = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": refresh_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, data=data)
                
                if response.status_code == 204:  # Keycloak returns 204 No Content on successful logout
                    return {"success": True, "message": "User logged out successfully"}
                else:
                    logger.error(f"Keycloak logout failed: {response.text}")
                    return {"success": False, "error": "Keycloak logout failed"}
                    
        except Exception as e:
            logger.error(f"Error during Keycloak logout: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def validate_access_token(self, access_token: str) -> Dict[str, Any]:
        # Debug token structure first
        try:
            unverified = jwt.decode(access_token, options={"verify_signature": False})
            logger.info(f"Token payload keys: {list(unverified.keys())}")
            logger.info(f"Token aud (audience): {unverified.get('aud')}")
            logger.info(f"Token iss (issuer): {unverified.get('iss')}")
            logger.info(f"Token exp (expires): {unverified.get('exp')}")
            logger.info(f"Token typ (type): {unverified.get('typ')}")
            logger.info(f"Token scope: {unverified.get('scope')}")
        except Exception as debug_e:
            logger.warning(f"Could not debug token structure: {debug_e}")
        try:
            # Debug token structure
            unverified = jwt.decode(access_token, options={"verify_signature": False})
            token_aud = unverified.get('aud')
            
            logger.info(f"Token audience: {token_aud}")
            logger.info(f"Expected client_id: {self.client_id}")
            
            # Handle different audience formats
            valid_audiences = [
                self.client_id,  # Our client ID
                'account',       # Keycloak's default account service
                'account-console' # Another common Keycloak audience
            ]
            
            # Check if token audience is valid
            if isinstance(token_aud, list):
                audience_valid = any(aud in valid_audiences for aud in token_aud)
            else:
                audience_valid = token_aud in valid_audiences
                
            logger.info(f"Audience validation result: {audience_valid}")
            url = f"{self.keycloak_url}/realms/{self.realm}/protocol/openid-connect/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code == 200:
                    user_info = response.json()
                    logger.info(f"Token validation successful for user: {user_info.get('sub', 'unknown')}")
                    return {
                        "success": True, 
                        "user_info": user_info
                    }
                elif response.status_code == 401:
                    logger.warning("Token validation failed: Invalid or expired token")
                    return {
                        "success": False, 
                        "error": "Invalid or expired token"
                    }
                else:
                    logger.error(f"Token validation failed with status {response.status_code}: {response.text}")
                    return {
                        "success": False, 
                        "error": f"Validation failed with status {response.status_code}"
                    }
                    
        except httpx.TimeoutException:
            logger.error("Token validation timeout")
            return {"success": False, "error": "Validation timeout"}
        except Exception as e:
            logger.error(f"Error validating token: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def introspect_token(self, token: str, token_type_hint: str = "access_token") -> Dict[str, Any]:
        """
    Alternative: Use Keycloak's introspection endpoint for more detailed token info.
    This provides more information but requires client credentials.
    """
        try:
            url = f"{self.keycloak_url}/realms/{self.realm}/protocol/openid-connect/token/introspect"
            
            data = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "token": token,
                "token_type_hint": token_type_hint
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, data=data)
                
                if response.status_code == 200:
                    introspection_result = response.json()
                    is_active = introspection_result.get("active", False)
                    
                    if is_active:
                        return {
                            "success": True,
                            "active": True,
                            "token_info": introspection_result
                        }
                    else:
                        return {
                            "success": False,
                            "active": False,
                            "error": "Token is not active"
                        }
                else:
                    logger.error(f"Token introspection failed: {response.text}")
                    return {
                        "success": False,
                        "error": "Introspection failed"
                    }
                    
        except Exception as e:
            logger.error(f"Error during token introspection: {str(e)}")
            return {"success": False, "error": str(e)}
    async def validate_refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Validate refresh token by attempting to use it.
        This is more reliable than JWT parsing for refresh tokens.
        """
        try:
            # The most reliable way to validate a refresh token is to try using it
            # We'll do a lightweight introspection call
            url = f"{self.keycloak_url}/realms/{self.realm}/protocol/openid-connect/token/introspect"
            
            data = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "token": refresh_token,
                "token_type_hint": "refresh_token"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, data=data)
                
                if response.status_code == 200:
                    introspection_result = response.json()
                    is_active = introspection_result.get("active", False)
                    
                    if is_active:
                        return {
                            "success": True,
                            "user_id": introspection_result.get("sub"),
                            "expires_at": introspection_result.get("exp"),
                            "client_id": introspection_result.get("client_id")
                        }
                    else:
                        return {
                            "success": False,
                            "error": "Refresh token is not active or expired"
                        }
                else:
                    logger.error(f"Refresh token validation failed with status {response.status_code}: {response.text}")
                    return {
                        "success": False,
                        "error": f"Validation failed with status {response.status_code}"
                    }
                
        except httpx.TimeoutException:
            logger.error("Refresh token validation timeout")
            return {"success": False, "error": "Validation timeout"}
        except Exception as e:
            logger.error(f"Error validating refresh token: {str(e)}")
            return {"success": False, "error": str(e)}
    

keycloak_service = KeycloakService()
