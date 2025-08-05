import redis
import json
import logging
from typing import Dict, Any, Optional
from ..core.config import settings

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self):
        self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        
    async def ping(self) -> bool:
        """Check if Redis is available"""
        try:
            return self.redis_client.ping()
        except Exception as e:
            logger.error(f"Redis ping failed: {str(e)}")
            return False
    
    async def store_refresh_token(self, user_id: int, refresh_token: str, expires_in: int = 86400) -> bool:
        """Store refresh token in Redis with expiration"""
        try:
            key = f"refresh_token:{user_id}"
            self.redis_client.setex(key, expires_in, refresh_token)
            logger.info(f"Refresh token stored for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to store refresh token: {str(e)}")
            return False
    
    async def get_refresh_token(self, user_id: int) -> Optional[str]:
        """Get refresh token from Redis"""
        try:
            key = f"refresh_token:{user_id}"
            return self.redis_client.get(key)
        except Exception as e:
            logger.error(f"Failed to get refresh token: {str(e)}")
            return None
    
    async def delete_refresh_token(self, user_id: int) -> bool:
        """Delete refresh token from Redis"""
        try:
            key = f"refresh_token:{user_id}"
            self.redis_client.delete(key)
            logger.info(f"Refresh token deleted for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete refresh token: {str(e)}")
            return False
    
    async def store_user_backup(self, user_id: int, user_data: Dict[str, Any]) -> bool:
        """Store user data backup in Redis"""
        try:
            key = f"user_backup:{user_id}"
            self.redis_client.set(key, json.dumps(user_data))
            logger.info(f"User backup stored for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to store user backup: {str(e)}")
            return False
    
    async def get_user_backup(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user data backup from Redis"""
        try:
            key = f"user_backup:{user_id}"
            data = self.redis_client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Failed to get user backup: {str(e)}")
            return None
    
    async def store_user_by_email_backup(self, email: str, user_data: Dict[str, Any]) -> bool:
        """Store user data backup by email in Redis"""
        try:
            key = f"user_email_backup:{email}"
            self.redis_client.set(key, json.dumps(user_data))
            logger.info(f"User email backup stored for {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to store user email backup: {str(e)}")
            return False
    
    async def get_user_by_email_backup(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user data backup by email from Redis"""
        try:
            key = f"user_email_backup:{email}"
            data = self.redis_client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Failed to get user email backup: {str(e)}")
            return None

redis_service = RedisService()
