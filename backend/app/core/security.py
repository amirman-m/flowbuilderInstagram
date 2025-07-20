from passlib.context import CryptContext
from typing import Optional

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


def create_simple_session(user_id: int) -> str:
    """Create a simple session token (not JWT)."""
    import hashlib
    import time
    
    # Simple session token: hash of user_id + timestamp
    session_data = f"{user_id}:{int(time.time())}"
    return hashlib.sha256(session_data.encode()).hexdigest()


def verify_simple_session(session_token: str, user_id: int) -> bool:
    """Verify simple session token (basic implementation)."""
    # In a real app, you'd store sessions in database/redis
    # For now, just check if token exists and is not empty
    return session_token and len(session_token) == 64
