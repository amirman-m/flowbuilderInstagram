import pytest
import asyncio
import json
import time
import os
from unittest.mock import patch, MagicMock, AsyncMock
import sys
from pathlib import Path

# Add backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Set environment variables BEFORE any app imports
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://mock-redis:6379/0"
os.environ["KEYCLOAK_URL"] = "http://mock-keycloak:8080"
os.environ["KEYCLOAK_REALM"] = "mock-realm"
os.environ["KEYCLOAK_CLIENT_ID"] = "mock-client"
os.environ["KEYCLOAK_CLIENT_SECRET"] = "mock-secret"
os.environ["KEYCLOAK_ADMIN_USERNAME"] = "mock-admin"
os.environ["KEYCLOAK_ADMIN_PASSWORD"] = "mock-password"
os.environ["ENVIRONMENT"] = "testing"

# Patch SQLAlchemy engine and session creation BEFORE importing app modules
# This prevents SQLite thread issues by ensuring no real DB connections are made
with patch('sqlalchemy.create_engine') as mock_create_engine:
    # Mock the engine
    mock_engine = MagicMock()
    mock_create_engine.return_value = mock_engine
    
    # Also patch sessionmaker
    with patch('sqlalchemy.orm.sessionmaker') as mock_sessionmaker:
        mock_session_factory = MagicMock()
        mock_sessionmaker.return_value = mock_session_factory

# Now import app modules after environment variables are set
from fastapi.testclient import TestClient
from fastapi import FastAPI, status
from app.main import app
from app.api.v1.auth import router as auth_router

# Create test client
@pytest.fixture(scope="session")
def client():
    """Create FastAPI test client"""
    with TestClient(app) as test_client:
        yield test_client

# Configure asyncio for pytest
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# We don't need this fixture anymore since we set env vars at module level
# But we'll keep a settings fixture to ensure test environment
@pytest.fixture(autouse=True, scope="session")
def test_settings():
    """Ensure we're in test environment"""
    from app.core.config import settings
    assert settings.environment == "testing", "Not in testing environment"
    yield settings

# Define mock data for tests
@pytest.fixture(scope="session")
def mock_data():
    """Common mock data for tests"""
    return {
        "user": {
            "id": "test-user-id",
            "email": "test@example.com",
            "name": "Test User",
            "keycloak_id": "test-keycloak-id",
            "is_active": True
        },
        "keycloak_success": {
            "success": True,
            "user_id": "test-keycloak-id",
            "access_token": "test-access-token",
            "refresh_token": "test-refresh-token",
            "expires_in": 300
        },
        "rate_limit_data": {
            "attempts": 1,
            "first_attempt": time.time(),
            "last_attempt": time.time()
        }
    }

# Mock UserService with AsyncMock for all methods
@pytest.fixture(autouse=True)
def mock_user_service():
    """Mock UserService to prevent real database access"""
    with patch("app.api.v1.auth.get_user_service") as mock_get_service:
        mock_service = AsyncMock()
        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.email = "test@example.com"
        mock_user.name = "Test User"
        mock_user.keycloak_id = "test-keycloak-id"
        mock_user.is_active = True
        
        # Configure mock methods
        mock_service.get_user_by_email = AsyncMock(return_value=None)  # Default to no user found
        mock_service.get_user_by_keycloak_id = AsyncMock(return_value=mock_user)
        mock_service.create_user = AsyncMock(return_value=mock_user)
        
        # Return the mock service from get_user_service
        mock_get_service.return_value = mock_service
        yield mock_service

# Mock RedisService with AsyncMock for all methods
@pytest.fixture(autouse=True)
def mock_redis_service():
    """Mock RedisService with AsyncMock for all methods"""
    with patch("app.api.v1.auth.redis_service") as mock:
        # Configure redis client
        mock.redis_client = AsyncMock()
        mock.redis_client.get = AsyncMock(return_value=json.dumps({"attempts": 1, "first_attempt": time.time(), "last_attempt": time.time()}))
        mock.redis_client.setex = AsyncMock(return_value=True)
        mock.redis_client.delete = AsyncMock(return_value=True)
        mock.redis_client.keys = AsyncMock(return_value=[])
        mock.redis_client.scan_iter = AsyncMock(return_value=[])
        
        # Configure service methods
        mock.store_refresh_token = AsyncMock(return_value=True)
        mock.get_refresh_token = AsyncMock(return_value="mock-refresh-token")
        mock.store_access_token = AsyncMock(return_value=True)
        mock.cleanup_user_tokens = AsyncMock(return_value=True)
        mock.store_user_backup = AsyncMock(return_value=True)
        mock.get_user_backup = AsyncMock(return_value=None)
        
        yield mock

# Mock KeycloakService with AsyncMock for all methods
@pytest.fixture(autouse=True)
def mock_keycloak_service():
    """Mock KeycloakService with successful responses"""
    with patch("app.api.v1.auth.keycloak_service") as mock:
        # Configure methods
        mock.authenticate_user = AsyncMock(return_value={
            "success": True, 
            "user_id": "test-keycloak-id",
            "access_token": "test-access-token",
            "refresh_token": "test-refresh-token",
            "expires_in": 300
        })
        mock.create_user_in_keycloak = AsyncMock(return_value={
            "success": True, 
            "user_id": "test-keycloak-id"
        })
        mock.refresh_token = AsyncMock(return_value={
            "success": True,
            "access_token": "new-access-token",
            "refresh_token": "new-refresh-token",
            "expires_in": 300
        })
        mock.revoke_tokens = AsyncMock(return_value={"success": True})
        mock.logout_user = AsyncMock(return_value={"success": True})
        mock.validate_refresh_token = AsyncMock(return_value={"success": True, "user_id": "test-keycloak-id"})
        
        yield mock

# Mock TokenService with AsyncMock for all methods
@pytest.fixture(autouse=True)
def mock_token_service():
    """Mock TokenService with valid token responses"""
    with patch("app.api.v1.auth.token_service") as mock:
        # Configure methods
        mock.extract_access_token_from_request = AsyncMock(return_value="valid-access-token")
        mock.extract_refresh_token_from_request = AsyncMock(return_value="valid-refresh-token")
        mock.get_user_id_from_request = AsyncMock(return_value="test-keycloak-id")
        mock.get_user_id_from_token = AsyncMock(return_value="test-keycloak-id")
        mock.get_refresh_token_hybrid = AsyncMock(return_value="valid-refresh-token")
        
        yield mock

# Mock rate limiter to bypass rate limiting
@pytest.fixture(autouse=True)
def mock_rate_limiter():
    """Mock rate limiter to bypass rate limiting"""
    with patch("app.api.v1.auth.multi_layer_rate_limit") as mock:
        # Make the decorator a pass-through that returns the original function
        mock.return_value = lambda func: func
        yield mock

# Mock database session and override get_db dependency
@pytest.fixture(autouse=True)
def mock_db():
    """Mock database session and override get_db dependency"""
    # Create a mock session
    mock_session = MagicMock()
    mock_session.add = MagicMock()
    mock_session.commit = MagicMock()
    mock_session.rollback = MagicMock()
    mock_session.refresh = MagicMock()
    mock_session.query = MagicMock()
    mock_session.close = MagicMock()
    
    # Create a generator function that yields the mock session
    def mock_get_db_generator():
        yield mock_session
    
    # Patch the get_db dependency
    with patch("app.core.database.get_db", side_effect=mock_get_db_generator):
        yield mock_session
