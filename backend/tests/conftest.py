import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

# Configure asyncio for pytest
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# Mock database session
@pytest.fixture
def mock_db_session():
    """Mock database session for testing"""
    session = MagicMock()
    session.add = MagicMock()
    session.commit = MagicMock()
    session.rollback = MagicMock()
    session.refresh = MagicMock()
    session.query = MagicMock()
    return session

# Mock Redis client
@pytest.fixture
def mock_redis_client():
    """Mock Redis client for testing"""
    client = AsyncMock()
    client.get = AsyncMock()
    client.setex = AsyncMock()
    client.delete = AsyncMock()
    client.ping = AsyncMock()
    client.keys = AsyncMock()
    client.scan_iter = AsyncMock()
    return client

# Mock HTTP client for Keycloak
@pytest.fixture
def mock_http_client():
    """Mock HTTP client for Keycloak requests"""
    client = AsyncMock()
    client.post = AsyncMock()
    client.get = AsyncMock()
    return client

# Test environment settings
@pytest.fixture(autouse=True)
def test_settings():
    """Override settings for testing"""
    from app.core.config import settings
    original_environment = settings.environment
    settings.environment = "testing"
    yield settings
    settings.environment = original_environment
