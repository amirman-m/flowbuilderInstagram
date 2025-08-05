from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from ..models.user import User
from ..services.redis_service import redis_service
import logging

logger = logging.getLogger(__name__)

class UserService:
    def __init__(self, db: Session):
        self.db = db
    
    async def create_user(self, email: str, name: str, keycloak_id: str) -> Optional[User]:
        """Create user in Postgres and backup in Redis"""
        try:
            # Create user in Postgres
            db_user = User(
                email=email,
                name=name,
                keycloak_id=keycloak_id,
                is_active=True
            )
            self.db.add(db_user)
            self.db.commit()
            self.db.refresh(db_user)
            
            # Create backup in Redis
            user_data = {
                "id": db_user.id,
                "email": db_user.email,
                "name": db_user.name,
                "keycloak_id": db_user.keycloak_id,
                "is_active": db_user.is_active,
                "created_at": db_user.created_at.isoformat() if db_user.created_at else None
            }
            
            await redis_service.store_user_backup(db_user.id, user_data)
            await redis_service.store_user_by_email_backup(email, user_data)
            
            logger.info(f"User created successfully: {email} (ID: {db_user.id})")
            return db_user
            
        except Exception as e:
            logger.error(f"Failed to create user: {str(e)}")
            self.db.rollback()
            return None
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email with Redis fallback"""
        try:
            # Try Postgres first
            user = self.db.query(User).filter(User.email == email).first()
            if user:
                return user
            
            # Fallback to Redis
            logger.warning("Postgres unavailable, trying Redis backup")
            user_data = await redis_service.get_user_by_email_backup(email)
            if user_data:
                # Create a User-like object from Redis data
                user = User()
                user.id = user_data["id"]
                user.email = user_data["email"]
                user.name = user_data["name"]
                user.keycloak_id = user_data["keycloak_id"]
                user.is_active = user_data["is_active"]
                return user
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by email: {str(e)}")
            # Try Redis as fallback
            try:
                user_data = await redis_service.get_user_by_email_backup(email)
                if user_data:
                    user = User()
                    user.id = user_data["id"]
                    user.email = user_data["email"]
                    user.name = user_data["name"]
                    user.keycloak_id = user_data["keycloak_id"]
                    user.is_active = user_data["is_active"]
                    return user
            except Exception as redis_error:
                logger.error(f"Redis fallback also failed: {str(redis_error)}")
            
            return None
    
    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID with Redis fallback"""
        try:
            # Try Postgres first
            user = self.db.query(User).filter(User.id == user_id).first()
            if user:
                return user
            
            # Fallback to Redis
            logger.warning("Postgres unavailable, trying Redis backup")
            user_data = await redis_service.get_user_backup(user_id)
            if user_data:
                user = User()
                user.id = user_data["id"]
                user.email = user_data["email"]
                user.name = user_data["name"]
                user.keycloak_id = user_data["keycloak_id"]
                user.is_active = user_data["is_active"]
                return user
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by ID: {str(e)}")
            # Try Redis as fallback
            try:
                user_data = await redis_service.get_user_backup(user_id)
                if user_data:
                    user = User()
                    user.id = user_data["id"]
                    user.email = user_data["email"]
                    user.name = user_data["name"]
                    user.keycloak_id = user_data["keycloak_id"]
                    user.is_active = user_data["is_active"]
                    return user
            except Exception as redis_error:
                logger.error(f"Redis fallback also failed: {str(redis_error)}")
            
            return None
    
    async def get_user_by_keycloak_id(self, keycloak_id: str) -> Optional[User]:
        """Get user by Keycloak ID with Redis fallback"""
        try:
            # Try Postgres first
            user = self.db.query(User).filter(User.keycloak_id == keycloak_id).first()
            if user:
                return user
            
            # For Redis fallback, we'd need to implement a keycloak_id index
            # For now, we'll skip Redis fallback for this method
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by Keycloak ID: {str(e)}")
            return None
