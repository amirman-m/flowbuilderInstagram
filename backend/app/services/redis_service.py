import redis.asyncio as redis
import json
import logging
from typing import Dict, Any, Optional
from ..core.config import settings
import time
logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self):
        self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        
    async def ping(self) -> bool:
        """Check if Redis is available"""
        try:
            return await self.redis_client.ping()
        except redis.ConnectionError as e:
            logger.error(f"Redis connection failed: {str(e)}")
            return False
        except redis.TimeoutError as e:
            logger.error(f"Redis timeout: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Redis ping failed: {str(e)}")
            return False
    
    async def store_refresh_token(self, user_id: int, refresh_token: str, expires_in: int = 86400) -> bool:
        """Store refresh token in Redis with expiration"""
        try:
            key = f"refresh_token:{user_id}"
            await self.redis_client.setex(key, expires_in, refresh_token)
            logger.info(f"Refresh token stored for user {user_id}")
            return True
        except redis.ConnectionError as e:
            logger.error(f"Redis connection failed while storing token for user {user_id}: {str(e)}")
            return False
        except redis.TimeoutError as e:
            logger.error(f"Redis timeout while storing token for user {user_id}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Failed to store refresh token for user {user_id}: {str(e)}")
            return False
    
    async def get_refresh_token(self, user_id: int) -> Optional[str]:
        """Get refresh token from Redis"""
        try:
            key = f"refresh_token:{user_id}"
            return await self.redis_client.get(key)
        except redis.ConnectionError as e:
            logger.error(f"Redis connection failed while getting token for user {user_id}: {str(e)}")
            return None
        except redis.TimeoutError as e:
            logger.error(f"Redis timeout while getting token for user {user_id}: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Failed to get refresh token for user {user_id}: {str(e)}")
            return None
    
    async def delete_refresh_token(self, user_id: int) -> bool:
        """Delete refresh token from Redis"""
        try:
            key = f"refresh_token:{user_id}"
            result = await self.redis_client.delete(key)
            if result > 0:
                logger.info(f"Refresh token deleted for user {user_id}")
                return True
            else:
                logger.warning(f"No refresh token found to delete for user {user_id}")
                return False
        except redis.ConnectionError as e:
            logger.error(f"Redis connection failed while deleting token for user {user_id}: {str(e)}")
            return False
        except redis.TimeoutError as e:
            logger.error(f"Redis timeout while deleting token for user {user_id}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Failed to delete refresh token for user {user_id}: {str(e)}")
            return False
    
    async def store_user_backup(self, user_id: int, user_data: Dict[str, Any]) -> bool:
        """Store user data backup in Redis"""
        try:
            key = f"user_backup:{user_id}"
            await self.redis_client.set(key, json.dumps(user_data))
            logger.info(f"User backup stored for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to store user backup: {str(e)}")
            return False
    
    async def get_user_backup(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user data backup from Redis"""
        try:
            key = f"user_backup:{user_id}"
            data = await self.redis_client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Failed to get user backup: {str(e)}")
            return None
    
    async def store_user_by_email_backup(self, email: str, user_data: Dict[str, Any]) -> bool:
        """Store user data backup by email in Redis"""
        try:
            key = f"user_email_backup:{email}"
            await self.redis_client.set(key, json.dumps(user_data))
            logger.info(f"User email backup stored for {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to store user email backup: {str(e)}")
            return False
    
    async def get_user_by_email_backup(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user data backup by email from Redis"""
        try:
            key = f"user_email_backup:{email}"
            data = await self.redis_client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Failed to get user email backup: {str(e)}")
            return None
    async def store_access_token(self, user_id: str, access_token: str, expires_in: int = 300) -> bool:
        """Store access token in Redis with expiration (default 5 minutes)"""
        try:
            key = f"access_token:{user_id}"
            await self.redis_client.setex(key, expires_in, access_token)
            logger.info(f"Access token stored for user {user_id} (expires in {expires_in}s)")
            return True
        except Exception as e:
            logger.error(f"Failed to store access token for user {user_id}: {str(e)}")
            return False

    async def get_access_token(self, user_id: str) -> Optional[str]:
        """Get access token from Redis"""
        try:
            key = f"access_token:{user_id}"
            return await self.redis_client.get(key)
        except Exception as e:
            logger.error(f"Failed to get access token for user {user_id}: {str(e)}")
            return None

    async def delete_access_token(self, user_id: str) -> bool:
        """Delete access token from Redis"""
        try:
            key = f"access_token:{user_id}"
            result = await self.redis_client.delete(key)
            if result > 0:
                logger.info(f"Access token deleted for user {user_id}")
                return True
            else:
                logger.warning(f"No access token found to delete for user {user_id}")
                return False
        except Exception as e:
            logger.error(f"Failed to delete access token for user {user_id}: {str(e)}")
            return False

    async def validate_access_token(self, user_id: str, token: str) -> bool:
        """Validate if the provided access token matches the one stored in Redis"""
        try:
            stored_token = await self.get_access_token(user_id)
            return stored_token == token if stored_token else False
        except Exception as e:
            logger.error(f"Failed to validate access token for user {user_id}: {str(e)}")
            return False

    async def invalidate_token_validation_cache(self, user_id: str) -> bool:
        """Invalidate cached token validation results"""
        try:
            cache_key = f"token_validated:{user_id}"
            result = await self.redis_client.delete(cache_key)
            logger.info(f"Token validation cache invalidated for user {user_id}")
            return result > 0
        except Exception as e:
            logger.error(f"Failed to invalidate token validation cache for user {user_id}: {str(e)}")
            return False

    async def store_token_validation_cache(self, user_id: str, validation_data: Dict[str, Any], expires_in: int = 300) -> bool:
        """Cache token validation results"""
        try:
            cache_key = f"token_validated:{user_id}"
            await self.redis_client.setex(
                cache_key, 
                expires_in, 
                json.dumps({
                    "timestamp": time.time(),
                    "validated": True,
                    **validation_data
                })
            )
            return True
        except Exception as e:
            logger.error(f"Failed to cache token validation for user {user_id}: {str(e)}")
            return False

    async def get_token_validation_cache(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get cached token validation results"""
        try:
            cache_key = f"token_validated:{user_id}"
            cached_data = await self.redis_client.get(cache_key)
            return json.loads(cached_data) if cached_data else None
        except Exception as e:
            logger.error(f"Failed to get token validation cache for user {user_id}: {str(e)}")
            return None

    async def cleanup_user_tokens(self, user_id: str) -> bool:
        """Clean up all tokens for a user (useful for logout)"""
        try:
            keys_to_delete = [
                f"access_token:{user_id}",
                f"refresh_token:{user_id}",
                f"token_validated:{user_id}"
            ]
            
            deleted = await self.redis_client.delete(*keys_to_delete)
            logger.info(f"Cleaned up {deleted} token-related keys for user {user_id}")
            return deleted > 0
        except Exception as e:
            logger.error(f"Failed to cleanup tokens for user {user_id}: {str(e)}")
            raise Exception(f"Token cleanup failed: {str(e)}")

redis_service = RedisService()
