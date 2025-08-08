import pytest
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
import json

from app.api.v1.auth import router as auth_router
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin
from app.services.keycloak_service import KeycloakService
from app.services.redis_service import RedisService
from app.services.user_service import UserService
from app.utils.rate_limiter import MultiLayerRateLimiter

# Create test app
app = FastAPI()
app.include_router(auth_router, prefix="/auth")
client = TestClient(app)

# Test data
VALID_USER_DATA = {
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
}

VALID_LOGIN_DATA = {
    "email": "test@example.com",
    "password": "TestPassword123!"
}

MOCK_KEYCLOAK_SUCCESS = {
    "success": True,
    "keycloak_id": "test-keycloak-id-123",
    "access_token": "mock-access-token",
    "refresh_token": "mock-refresh-token",
    "expires_in": 300
}

MOCK_USER = User(
    id=1,
    email="test@example.com",
    name="Test User",
    keycloak_id="test-keycloak-id-123",
    is_active=True
)

class TestRegistration:
    """Test registration endpoint security"""

    @patch('app.api.v1.auth.keycloak_service')
    @patch('app.api.v1.auth.redis_service')
    @patch('app.api.v1.auth.multi_layer_rate_limit')
    async def test_register_success(self, mock_rate_limit, mock_redis, mock_keycloak):
        """Test successful registration"""
        mock_rate_limit.return_value = lambda func: func
        mock_keycloak.create_user_in_keycloak.return_value = MOCK_KEYCLOAK_SUCCESS
        mock_redis.store_user_backup.return_value = True
        
        with patch('app.api.v1.auth.get_user_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_service.get_user_by_email.return_value = None
            mock_service.create_user.return_value = MOCK_USER
            mock_get_service.return_value = mock_service
            
            response = client.post("/auth/register", json=VALID_USER_DATA)
            
            assert response.status_code == status.HTTP_201_CREATED
            assert response.json()["email"] == VALID_USER_DATA["email"]

    async def test_register_duplicate_email_blocked(self):
        """Test duplicate email registration is blocked"""
        with patch('app.api.v1.auth.get_user_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_service.get_user_by_email.return_value = MOCK_USER
            mock_get_service.return_value = mock_service
            
            with patch('app.api.v1.auth.multi_layer_rate_limit') as mock_rate_limit:
                mock_rate_limit.return_value = lambda func: func
                
                response = client.post("/auth/register", json=VALID_USER_DATA)
                assert response.status_code == status.HTTP_400_BAD_REQUEST
                assert "Email already registered" in response.json()["detail"]

    async def test_register_rate_limit_blocks_attack(self):
        """Test registration rate limiting blocks rapid attempts"""
        from fastapi import HTTPException
        
        with patch('app.api.v1.auth.multi_layer_rate_limit') as mock_rate_limit:
            def rate_limit_exceeded(func):
                def wrapper(*args, **kwargs):
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Registration rate limit exceeded"
                    )
                return wrapper
            
            mock_rate_limit.return_value = rate_limit_exceeded
            response = client.post("/auth/register", json=VALID_USER_DATA)
            assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

class TestLogin:
    """Test login endpoint security"""

    @patch('app.api.v1.auth.keycloak_service')
    @patch('app.api.v1.auth.redis_service')
    @patch('app.api.v1.auth.multi_layer_rate_limit')
    async def test_login_success(self, mock_rate_limit, mock_redis, mock_keycloak):
        """Test successful login sets secure cookies"""
        mock_rate_limit.return_value = lambda func: func
        mock_keycloak.authenticate_user.return_value = MOCK_KEYCLOAK_SUCCESS
        mock_redis.store_refresh_token.return_value = True
        mock_redis.store_access_token.return_value = True
        
        with patch('app.api.v1.auth.get_user_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_service.get_user_by_email.return_value = MOCK_USER
            mock_get_service.return_value = mock_service
            
            response = client.post("/auth/login", json=VALID_LOGIN_DATA)
            
            assert response.status_code == status.HTTP_200_OK
            assert "access_token" in response.cookies
            assert "refresh_token" in response.cookies
            assert response.cookies["access_token"]["httponly"] is True

    async def test_login_brute_force_blocked(self):
        """Test brute force login attack is blocked"""
        from fastapi import HTTPException
        
        with patch('app.api.v1.auth.multi_layer_rate_limit') as mock_rate_limit:
            def rate_limit_exceeded(func):
                def wrapper(*args, **kwargs):
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Login rate limit exceeded"
                    )
                return wrapper
            
            mock_rate_limit.return_value = rate_limit_exceeded
            response = client.post("/auth/login", json=VALID_LOGIN_DATA)
            assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    @patch('app.api.v1.auth.keycloak_service')
    @patch('app.api.v1.auth.multi_layer_rate_limit')
    async def test_login_invalid_credentials_blocked(self, mock_rate_limit, mock_keycloak):
        """Test invalid credentials are properly rejected"""
        mock_rate_limit.return_value = lambda func: func
        mock_keycloak.authenticate_user.return_value = {"success": False, "error": "Invalid credentials"}
        
        response = client.post("/auth/login", json={"email": "test@example.com", "password": "wrong"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

class TestLogout:
    """Test logout endpoint security"""

    @patch('app.api.v1.auth.token_service')
    @patch('app.api.v1.auth.keycloak_service')
    @patch('app.api.v1.auth.redis_service')
    async def test_logout_success(self, mock_redis, mock_keycloak, mock_token_service):
        """Test successful logout clears tokens"""
        mock_token_service.extract_access_token_from_request.return_value = "mock-token"
        mock_token_service.extract_refresh_token_from_request.return_value = "mock-refresh"
        mock_token_service.get_user_id_from_token.return_value = "test-user-id"
        mock_keycloak.revoke_tokens.return_value = {"success": True}
        mock_keycloak.logout_user.return_value = {"success": True}
        mock_redis.cleanup_user_tokens.return_value = True
        
        response = client.post("/auth/logout")
        assert response.status_code == status.HTTP_200_OK

    @patch('app.api.v1.auth.token_service')
    async def test_logout_no_tokens_blocked(self, mock_token_service):
        """Test logout without tokens is blocked"""
        mock_token_service.extract_access_token_from_request.return_value = None
        mock_token_service.extract_refresh_token_from_request.return_value = None
        
        response = client.post("/auth/logout")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

class TestRefreshToken:
    """Test token refresh security"""

    @patch('app.api.v1.auth.token_service')
    @patch('app.api.v1.auth.keycloak_service')
    @patch('app.api.v1.auth.redis_service')
    async def test_refresh_success(self, mock_redis, mock_keycloak, mock_token_service):
        """Test successful token refresh"""
        mock_token_service.get_refresh_token_hybrid.return_value = "mock-refresh-token"
        mock_keycloak.validate_refresh_token.return_value = {"success": True, "user_id": "test-id"}
        mock_keycloak.refresh_token.return_value = {
            "success": True,
            "access_token": "new-access-token",
            "refresh_token": "new-refresh-token",
            "expires_in": 300
        }
        
        with patch('app.api.v1.auth.get_user_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_service.get_user_by_keycloak_id.return_value = MOCK_USER
            mock_get_service.return_value = mock_service
            
            response = client.post("/auth/refresh")
            assert response.status_code == status.HTTP_200_OK

    async def test_refresh_spam_attack_blocked(self):
        """Test rapid refresh attempts are blocked"""
        from fastapi import HTTPException
        
        with patch('app.api.v1.auth.multi_layer_rate_limit') as mock_rate_limit:
            def rate_limit_exceeded(func):
                def wrapper(*args, **kwargs):
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Refresh rate limit exceeded"
                    )
                return wrapper
            
            mock_rate_limit.return_value = rate_limit_exceeded
            response = client.post("/auth/refresh")
            assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

class TestRateLimiter:
    """Test rate limiter functionality"""

    @pytest.fixture
    def rate_limiter(self):
        return MultiLayerRateLimiter()

    @patch('app.utils.rate_limiter.redis_service')
    async def test_rate_limit_first_attempt_allowed(self, mock_redis, rate_limiter):
        """Test first attempt is allowed"""
        mock_redis.redis_client.get.return_value = None
        mock_redis.redis_client.setex.return_value = True
        
        result = await rate_limiter.is_rate_limited("test_key", 5, 300)
        assert result["blocked"] is False
        assert result["attempts"] == 1

    @patch('app.utils.rate_limiter.redis_service')
    async def test_rate_limit_blocks_after_threshold(self, mock_redis, rate_limiter):
        """Test rate limit blocks after threshold exceeded"""
        attempt_data = {
            "attempts": 5,
            "first_attempt": time.time(),
            "last_attempt": time.time()
        }
        mock_redis.redis_client.get.return_value = json.dumps(attempt_data)
        mock_redis.redis_client.setex.return_value = True
        
        result = await rate_limiter.is_rate_limited("test_key", 5, 300)
        assert result["blocked"] is True
        assert "remaining_time" in result

    @patch('app.utils.rate_limiter.redis_service')
    async def test_rate_limit_window_reset(self, mock_redis, rate_limiter):
        """Test rate limit window reset after expiration"""
        old_time = time.time() - 400  # Expired window
        attempt_data = {
            "attempts": 10,
            "first_attempt": old_time,
            "last_attempt": old_time
        }
        mock_redis.redis_client.get.return_value = json.dumps(attempt_data)
        
        result = await rate_limiter.is_rate_limited("test_key", 5, 300)
        assert result["blocked"] is False
        assert result["attempts"] == 1  # Reset

class TestSecurityAttacks:
    """Test various security attack scenarios"""

    async def test_malformed_json_attack(self):
        """Test malformed JSON attack"""
        response = client.post(
            "/auth/register",
            data="invalid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_sql_injection_attempt(self):
        """Test SQL injection in email field"""
        malicious_data = {
            "email": "test'; DROP TABLE users; --",
            "password": "TestPassword123!",
            "name": "Malicious User"
        }
        response = client.post("/auth/register", json=malicious_data)
        assert response.status_code in [status.HTTP_422_UNPROCESSABLE_ENTITY, status.HTTP_400_BAD_REQUEST]

    @patch('app.api.v1.auth.token_service')
    async def test_expired_token_attack(self, mock_token_service):
        """Test expired token attack is blocked"""
        from fastapi import HTTPException
        
        mock_token_service.extract_access_token_from_request.return_value = "expired-token"
        mock_token_service.get_user_id_from_token.side_effect = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
        
        response = client.post("/auth/logout")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_missing_required_fields_blocked(self):
        """Test missing required fields are blocked"""
        incomplete_data = {"email": "test@example.com"}
        response = client.post("/auth/register", json=incomplete_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_invalid_email_format_blocked(self):
        """Test invalid email format is blocked"""
        invalid_data = {
            "email": "not-an-email",
            "password": "TestPassword123!",
            "name": "Test User"
        }
        response = client.post("/auth/register", json=invalid_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

class TestCookieSecurity:
    """Test cookie security attributes"""

    @patch('app.api.v1.auth.keycloak_service')
    @patch('app.api.v1.auth.redis_service')
    @patch('app.api.v1.auth.multi_layer_rate_limit')
    async def test_login_sets_secure_cookies(self, mock_rate_limit, mock_redis, mock_keycloak):
        """Test login sets HttpOnly cookies with proper attributes"""
        mock_rate_limit.return_value = lambda func: func
        mock_keycloak.authenticate_user.return_value = MOCK_KEYCLOAK_SUCCESS
        mock_redis.store_refresh_token.return_value = True
        mock_redis.store_access_token.return_value = True
        
        with patch('app.api.v1.auth.get_user_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_service.get_user_by_email.return_value = MOCK_USER
            mock_get_service.return_value = mock_service
            
            response = client.post("/auth/login", json=VALID_LOGIN_DATA)
            
            # Verify cookies are set with security attributes
            assert "access_token" in response.cookies
            assert "refresh_token" in response.cookies
            assert response.cookies["access_token"]["httponly"] is True
            assert response.cookies["refresh_token"]["httponly"] is True
            assert response.cookies["refresh_token"]["path"] == "/auth/refresh"

    @patch('app.api.v1.auth.token_service')
    @patch('app.api.v1.auth.keycloak_service')
    @patch('app.api.v1.auth.redis_service')
    async def test_logout_clears_cookies(self, mock_redis, mock_keycloak, mock_token_service):
        """Test logout clears cookies properly"""
        mock_token_service.extract_access_token_from_request.return_value = "mock-token"
        mock_token_service.extract_refresh_token_from_request.return_value = "mock-refresh"
        mock_token_service.get_user_id_from_token.return_value = "test-user-id"
        mock_keycloak.revoke_tokens.return_value = {"success": True}
        mock_keycloak.logout_user.return_value = {"success": True}
        mock_redis.cleanup_user_tokens.return_value = True
        
        response = client.post("/auth/logout")
        assert response.status_code == status.HTTP_200_OK
        # Cookies should be cleared
        assert response.cookies["access_token"]["expires"]
        assert response.cookies["refresh_token"]["expires"]

class TestTokenRotation:
    """Test token rotation security"""

    @patch('app.api.v1.auth.token_service')
    @patch('app.api.v1.auth.keycloak_service')
    @patch('app.api.v1.auth.redis_service')
    async def test_refresh_rotates_tokens(self, mock_redis, mock_keycloak, mock_token_service):
        """Test refresh endpoint rotates both tokens"""
        mock_token_service.get_refresh_token_hybrid.return_value = "old-refresh-token"
        mock_keycloak.validate_refresh_token.return_value = {"success": True, "user_id": "test-id"}
        mock_keycloak.refresh_token.return_value = {
            "success": True,
            "access_token": "new-access-token",
            "refresh_token": "new-refresh-token",
            "expires_in": 300
        }
        mock_redis.store_refresh_token.return_value = True
        mock_redis.store_access_token.return_value = True
        
        with patch('app.api.v1.auth.get_user_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_service.get_user_by_keycloak_id.return_value = MOCK_USER
            mock_get_service.return_value = mock_service
            
            response = client.post("/auth/refresh")
            
            assert response.status_code == status.HTTP_200_OK
            # Verify new tokens are set in cookies
            assert response.cookies["access_token"]["value"] != "old-access-token"
            assert response.cookies["refresh_token"]["value"] != "old-refresh-token"

class TestErrorHandling:
    """Test error handling and edge cases"""

    @patch('app.api.v1.auth.keycloak_service')
    async def test_keycloak_service_failure(self, mock_keycloak):
        """Test behavior when Keycloak service fails"""
        mock_keycloak.authenticate_user.side_effect = Exception("Keycloak unavailable")
        
        with patch('app.api.v1.auth.multi_layer_rate_limit') as mock_rate_limit:
            mock_rate_limit.return_value = lambda func: func
            
            response = client.post("/auth/login", json=VALID_LOGIN_DATA)
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @patch('app.api.v1.auth.redis_service')
    async def test_redis_failure_graceful_degradation(self, mock_redis):
        """Test graceful degradation when Redis fails"""
        mock_redis.store_user_backup.side_effect = Exception("Redis unavailable")
        
        with patch('app.api.v1.auth.keycloak_service') as mock_keycloak:
            mock_keycloak.create_user_in_keycloak.return_value = MOCK_KEYCLOAK_SUCCESS
            
            with patch('app.api.v1.auth.get_user_service') as mock_get_service:
                mock_service = AsyncMock()
                mock_service.get_user_by_email.return_value = None
                mock_service.create_user.return_value = MOCK_USER
                mock_get_service.return_value = mock_service
                
                with patch('app.api.v1.auth.multi_layer_rate_limit') as mock_rate_limit:
                    mock_rate_limit.return_value = lambda func: func
                    
                    response = client.post("/auth/register", json=VALID_USER_DATA)
                    # Should still succeed even if Redis backup fails
                    assert response.status_code == status.HTTP_201_CREATED
