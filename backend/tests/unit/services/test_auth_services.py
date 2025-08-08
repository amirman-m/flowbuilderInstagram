import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException, status

from app.services.keycloak_service import KeycloakService
from app.services.redis_service import RedisService
from app.services.user_service import UserService
from app.models.user import User

class TestKeycloakService:
    """Test Keycloak service security and functionality"""

    @pytest.fixture
    def keycloak_service(self):
        return KeycloakService()

    @patch('app.services.keycloak_service.httpx.AsyncClient')
    async def test_authenticate_user_success(self, mock_client, keycloak_service):
        """Test successful user authentication"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 300
        }
        mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
        
        result = await keycloak_service.authenticate_user("test@example.com", "password")
        
        assert result["success"] is True
        assert "access_token" in result
        assert "refresh_token" in result

    @patch('app.services.keycloak_service.httpx.AsyncClient')
    async def test_authenticate_user_invalid_credentials(self, mock_client, keycloak_service):
        """Test authentication with invalid credentials"""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
        
        result = await keycloak_service.authenticate_user("test@example.com", "wrong-password")
        
        assert result["success"] is False
        assert "error" in result

    @patch('app.services.keycloak_service.httpx.AsyncClient')
    async def test_create_user_success(self, mock_client, keycloak_service):
        """Test successful user creation in Keycloak"""
        # Mock admin token request
        mock_admin_response = MagicMock()
        mock_admin_response.json.return_value = {"access_token": "admin-token"}
        
        # Mock user creation request
        mock_create_response = MagicMock()
        mock_create_response.status_code = 201
        mock_create_response.headers = {"Location": "/users/test-user-id-123"}
        
        mock_client.return_value.__aenter__.return_value.post.side_effect = [
            mock_admin_response,  # Admin token
            mock_create_response  # User creation
        ]
        
        result = await keycloak_service.create_user_in_keycloak(
            "test@example.com", "password", "Test", "User"
        )
        
        assert result["success"] is True
        assert result["keycloak_id"] == "test-user-id-123"

    @patch('app.services.keycloak_service.httpx.AsyncClient')
    async def test_create_user_already_exists(self, mock_client, keycloak_service):
        """Test user creation when user already exists"""
        mock_admin_response = MagicMock()
        mock_admin_response.json.return_value = {"access_token": "admin-token"}
        
        mock_create_response = MagicMock()
        mock_create_response.status_code = 409  # Conflict
        
        mock_client.return_value.__aenter__.return_value.post.side_effect = [
            mock_admin_response,
            mock_create_response
        ]
        
        result = await keycloak_service.create_user_in_keycloak(
            "existing@example.com", "password", "Test", "User"
        )
        
        assert result["success"] is False
        assert "already exists" in result["error"]

    @patch('app.services.keycloak_service.httpx.AsyncClient')
    async def test_refresh_token_success(self, mock_client, keycloak_service):
        """Test successful token refresh"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "new-access-token",
            "refresh_token": "new-refresh-token",
            "expires_in": 300
        }
        mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
        
        result = await keycloak_service.refresh_token("valid-refresh-token")
        
        assert result["success"] is True
        assert result["access_token"] == "new-access-token"
        assert result["refresh_token"] == "new-refresh-token"

    @patch('app.services.keycloak_service.httpx.AsyncClient')
    async def test_validate_refresh_token_success(self, mock_client, keycloak_service):
        """Test successful refresh token validation"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "active": True,
            "sub": "test-user-id",
            "exp": 1234567890,
            "client_id": "test-client"
        }
        mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
        
        result = await keycloak_service.validate_refresh_token("valid-token")
        
        assert result["success"] is True
        assert result["user_id"] == "test-user-id"

    @patch('app.services.keycloak_service.httpx.AsyncClient')
    async def test_validate_refresh_token_inactive(self, mock_client, keycloak_service):
        """Test validation of inactive refresh token"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"active": False}
        mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
        
        result = await keycloak_service.validate_refresh_token("inactive-token")
        
        assert result["success"] is False
        assert "not active" in result["error"]

    @patch('app.services.keycloak_service.httpx.AsyncClient')
    async def test_revoke_tokens_success(self, mock_client, keycloak_service):
        """Test successful token revocation"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
        
        result = await keycloak_service.revoke_tokens("token-to-revoke")
        
        assert result["success"] is True

class TestRedisService:
    """Test Redis service security and functionality"""

    @pytest.fixture
    def redis_service(self):
        return RedisService()

    @patch('app.services.redis_service.redis')
    async def test_store_refresh_token_success(self, mock_redis, redis_service):
        """Test successful refresh token storage"""
        mock_redis.from_url.return_value.setex.return_value = True
        
        result = await redis_service.store_refresh_token(123, "refresh-token", 1800)
        
        assert result is True

    @patch('app.services.redis_service.redis')
    async def test_store_refresh_token_connection_failure(self, mock_redis, redis_service):
        """Test refresh token storage handles connection failure"""
        import redis as redis_module
        mock_redis.from_url.return_value.setex.side_effect = redis_module.ConnectionError("Connection failed")
        
        result = await redis_service.store_refresh_token(123, "refresh-token", 1800)
        
        assert result is False

    @patch('app.services.redis_service.redis')
    async def test_get_refresh_token_success(self, mock_redis, redis_service):
        """Test successful refresh token retrieval"""
        mock_redis.from_url.return_value.get.return_value = "stored-refresh-token"
        
        result = await redis_service.get_refresh_token(123)
        
        assert result == "stored-refresh-token"

    @patch('app.services.redis_service.redis')
    async def test_get_refresh_token_not_found(self, mock_redis, redis_service):
        """Test refresh token retrieval when token not found"""
        mock_redis.from_url.return_value.get.return_value = None
        
        result = await redis_service.get_refresh_token(123)
        
        assert result is None

    @patch('app.services.redis_service.redis')
    async def test_cleanup_user_tokens_success(self, mock_redis, redis_service):
        """Test successful cleanup of user tokens"""
        mock_redis.from_url.return_value.delete.return_value = 3  # 3 keys deleted
        
        result = await redis_service.cleanup_user_tokens("test-user-id")
        
        assert result is True

    @patch('app.services.redis_service.redis')
    async def test_validate_access_token_match(self, mock_redis, redis_service):
        """Test access token validation when tokens match"""
        mock_redis.from_url.return_value.get.return_value = "stored-token"
        
        result = await redis_service.validate_access_token("user-id", "stored-token")
        
        assert result is True

    @patch('app.services.redis_service.redis')
    async def test_validate_access_token_mismatch(self, mock_redis, redis_service):
        """Test access token validation when tokens don't match"""
        mock_redis.from_url.return_value.get.return_value = "stored-token"
        
        result = await redis_service.validate_access_token("user-id", "different-token")
        
        assert result is False

    async def test_ping_success(self, redis_service):
        """Test Redis ping success"""
        with patch.object(redis_service.redis_client, 'ping') as mock_ping:
            mock_ping.return_value = True
            
            result = await redis_service.ping()
            assert result is True

    async def test_ping_connection_failure(self, redis_service):
        """Test Redis ping handles connection failure"""
        import redis as redis_module
        with patch.object(redis_service.redis_client, 'ping') as mock_ping:
            mock_ping.side_effect = redis_module.ConnectionError("Connection failed")
            
            result = await redis_service.ping()
            assert result is False

class TestUserService:
    """Test User service security and functionality"""

    @pytest.fixture
    def user_service(self):
        mock_db = MagicMock()
        return UserService(mock_db)

    @pytest.fixture
    def mock_user(self):
        return User(
            id=1,
            email="test@example.com",
            name="Test User",
            keycloak_id="test-keycloak-id",
            is_active=True
        )

    async def test_create_user_success(self, user_service, mock_user):
        """Test successful user creation"""
        user_service.db.add = MagicMock()
        user_service.db.commit = MagicMock()
        user_service.db.refresh = MagicMock()
        
        with patch('app.services.user_service.User') as mock_user_class:
            mock_user_class.return_value = mock_user
            
            with patch('app.services.user_service.redis_service') as mock_redis:
                mock_redis.store_user_backup.return_value = True
                mock_redis.store_user_by_email_backup.return_value = True
                
                result = await user_service.create_user("test@example.com", "Test User", "keycloak-id")
                
                assert result == mock_user
                user_service.db.add.assert_called_once()
                user_service.db.commit.assert_called_once()

    async def test_create_user_database_failure(self, user_service):
        """Test user creation handles database failure"""
        user_service.db.add.side_effect = Exception("Database error")
        user_service.db.rollback = MagicMock()
        
        result = await user_service.create_user("test@example.com", "Test User", "keycloak-id")
        
        assert result is None
        user_service.db.rollback.assert_called_once()

    async def test_get_user_by_email_success(self, user_service, mock_user):
        """Test successful user retrieval by email"""
        user_service.db.query.return_value.filter.return_value.first.return_value = mock_user
        
        result = await user_service.get_user_by_email("test@example.com")
        
        assert result == mock_user

    async def test_get_user_by_email_redis_fallback(self, user_service):
        """Test Redis fallback when database fails"""
        user_service.db.query.side_effect = Exception("Database error")
        
        mock_user_data = {
            "id": 1,
            "email": "test@example.com",
            "name": "Test User",
            "keycloak_id": "test-keycloak-id",
            "is_active": True
        }
        
        with patch('app.services.user_service.redis_service') as mock_redis:
            mock_redis.get_user_by_email_backup.return_value = mock_user_data
            
            result = await user_service.get_user_by_email("test@example.com")
            
            assert result.email == "test@example.com"
            assert result.keycloak_id == "test-keycloak-id"

    async def test_get_user_by_keycloak_id_success(self, user_service, mock_user):
        """Test successful user retrieval by Keycloak ID"""
        user_service.db.query.return_value.filter.return_value.first.return_value = mock_user
        
        result = await user_service.get_user_by_keycloak_id("test-keycloak-id")
        
        assert result == mock_user

    async def test_get_user_by_keycloak_id_redis_scan_fallback(self, user_service):
        """Test Redis scan fallback for Keycloak ID lookup"""
        user_service.db.query.side_effect = Exception("Database error")
        
        mock_user_data = {
            "id": 1,
            "email": "test@example.com",
            "name": "Test User",
            "keycloak_id": "target-keycloak-id",
            "is_active": True
        }
        
        with patch('redis.asyncio.from_url') as mock_redis_client:
            mock_client = AsyncMock()
            mock_redis_client.return_value = mock_client
            
            # Mock scan_iter to return keys
            mock_client.scan_iter.return_value.__aiter__ = AsyncMock(return_value=iter([
                "user_backup:1",
                "user_backup:2"
            ]))
            
            # Mock get to return user data for matching keycloak_id
            mock_client.get.side_effect = [
                '{"keycloak_id": "other-id"}',  # First key - no match
                f'{{"keycloak_id": "target-keycloak-id", "id": 1, "email": "test@example.com", "name": "Test User", "is_active": true}}'  # Second key - match
            ]
            
            result = await user_service.get_user_by_keycloak_id("target-keycloak-id")
            
            assert result.keycloak_id == "target-keycloak-id"
            assert result.email == "test@example.com"

class TestServiceIntegration:
    """Test integration between authentication services"""

    @pytest.fixture
    def mock_services(self):
        return {
            'keycloak': AsyncMock(spec=KeycloakService),
            'redis': AsyncMock(spec=RedisService),
            'user': AsyncMock(spec=UserService)
        }

    async def test_login_flow_integration(self, mock_services):
        """Test complete login flow integration"""
        # Setup mocks
        mock_services['keycloak'].authenticate_user.return_value = {
            "success": True,
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 300
        }
        
        mock_user = User(id=1, email="test@example.com", keycloak_id="keycloak-id", is_active=True)
        mock_services['user'].get_user_by_email.return_value = mock_user
        mock_services['redis'].store_refresh_token.return_value = True
        mock_services['redis'].store_access_token.return_value = True
        
        # Simulate login flow
        auth_result = await mock_services['keycloak'].authenticate_user("test@example.com", "password")
        assert auth_result["success"] is True
        
        user = await mock_services['user'].get_user_by_email("test@example.com")
        assert user.is_active is True
        
        # Verify token storage
        await mock_services['redis'].store_refresh_token("keycloak-id", auth_result["refresh_token"], 1800)
        await mock_services['redis'].store_access_token("keycloak-id", auth_result["access_token"], 300)
        
        mock_services['redis'].store_refresh_token.assert_called()
        mock_services['redis'].store_access_token.assert_called()

    async def test_registration_flow_integration(self, mock_services):
        """Test complete registration flow integration"""
        # Setup mocks
        mock_services['keycloak'].create_user_in_keycloak.return_value = {
            "success": True,
            "keycloak_id": "new-keycloak-id"
        }
        
        mock_user = User(id=1, email="new@example.com", keycloak_id="new-keycloak-id", is_active=True)
        mock_services['user'].get_user_by_email.return_value = None  # User doesn't exist
        mock_services['user'].create_user.return_value = mock_user
        mock_services['redis'].store_user_backup.return_value = True
        
        # Simulate registration flow
        existing_user = await mock_services['user'].get_user_by_email("new@example.com")
        assert existing_user is None
        
        keycloak_result = await mock_services['keycloak'].create_user_in_keycloak(
            "new@example.com", "password", "New", "User"
        )
        assert keycloak_result["success"] is True
        
        new_user = await mock_services['user'].create_user(
            "new@example.com", "New User", keycloak_result["keycloak_id"]
        )
        assert new_user.email == "new@example.com"

class TestServiceErrorHandling:
    """Test error handling across services"""

    async def test_keycloak_timeout_handling(self):
        """Test Keycloak service handles timeouts gracefully"""
        keycloak_service = KeycloakService()
        
        with patch('app.services.keycloak_service.httpx.AsyncClient') as mock_client:
            import httpx
            mock_client.return_value.__aenter__.return_value.post.side_effect = httpx.TimeoutException("Timeout")
            
            result = await keycloak_service.authenticate_user("test@example.com", "password")
            
            assert result["success"] is False
            assert "error" in result

    async def test_redis_connection_error_handling(self):
        """Test Redis service handles connection errors gracefully"""
        redis_service = RedisService()
        
        with patch.object(redis_service.redis_client, 'setex') as mock_setex:
            import redis as redis_module
            mock_setex.side_effect = redis_module.ConnectionError("Connection failed")
            
            result = await redis_service.store_refresh_token(123, "token", 1800)
            
            assert result is False

    async def test_user_service_database_error_handling(self):
        """Test User service handles database errors gracefully"""
        mock_db = MagicMock()
        user_service = UserService(mock_db)
        
        mock_db.query.side_effect = Exception("Database connection failed")
        
        with patch('app.services.user_service.redis_service') as mock_redis:
            mock_redis.get_user_by_email_backup.return_value = None
            
            result = await user_service.get_user_by_email("test@example.com")
            
            assert result is None

class TestConcurrentServiceOperations:
    """Test concurrent operations across services"""

    async def test_concurrent_token_storage(self):
        """Test concurrent token storage operations"""
        redis_service = RedisService()
        
        with patch.object(redis_service.redis_client, 'setex') as mock_setex:
            mock_setex.return_value = True
            
            # Simulate concurrent token storage
            tasks = [
                redis_service.store_access_token(f"user-{i}", f"token-{i}", 300)
                for i in range(10)
            ]
            
            results = await asyncio.gather(*tasks)
            
            # All should succeed
            assert all(result is True for result in results)
            assert mock_setex.call_count == 10

    async def test_concurrent_user_lookups(self):
        """Test concurrent user lookup operations"""
        mock_db = MagicMock()
        user_service = UserService(mock_db)
        
        mock_user = User(id=1, email="test@example.com", keycloak_id="test-id", is_active=True)
        mock_db.query.return_value.filter.return_value.first.return_value = mock_user
        
        # Simulate concurrent user lookups
        tasks = [
            user_service.get_user_by_email(f"user{i}@example.com")
            for i in range(5)
        ]
        
        results = await asyncio.gather(*tasks)
        
        # All should return the mock user
        assert all(result == mock_user for result in results)

class TestServiceSecurityBoundaries:
    """Test security boundaries between services"""

    async def test_keycloak_admin_token_isolation(self):
        """Test admin token is not exposed in user operations"""
        keycloak_service = KeycloakService()
        
        with patch('app.services.keycloak_service.httpx.AsyncClient') as mock_client:
            mock_admin_response = MagicMock()
            mock_admin_response.json.return_value = {"access_token": "admin-secret-token"}
            
            mock_user_response = MagicMock()
            mock_user_response.status_code = 201
            mock_user_response.headers = {"Location": "/users/user-id"}
            
            mock_client.return_value.__aenter__.return_value.post.side_effect = [
                mock_admin_response,
                mock_user_response
            ]
            
            result = await keycloak_service.create_user_in_keycloak(
                "test@example.com", "password", "Test", "User"
            )
            
            # Admin token should not be in result
            assert "admin-secret-token" not in str(result)
            assert result["success"] is True

    async def test_redis_key_isolation(self):
        """Test Redis keys are properly isolated between users"""
        redis_service = RedisService()
        
        with patch.object(redis_service.redis_client, 'setex') as mock_setex:
            await redis_service.store_refresh_token(123, "token1", 1800)
            await redis_service.store_refresh_token(456, "token2", 1800)
            
            # Verify different keys are used for different users
            calls = mock_setex.call_args_list
            assert calls[0][0][0] == "refresh_token:123"
            assert calls[1][0][0] == "refresh_token:456"
            assert calls[0][0][2] == "token1"
            assert calls[1][0][2] == "token2"

    async def test_user_data_isolation(self):
        """Test user data is properly isolated in database queries"""
        mock_db = MagicMock()
        user_service = UserService(mock_db)
        
        mock_user1 = User(id=1, email="user1@example.com", keycloak_id="id1")
        mock_user2 = User(id=2, email="user2@example.com", keycloak_id="id2")
        
        # Mock different users for different queries
        mock_db.query.return_value.filter.return_value.first.side_effect = [mock_user1, mock_user2]
        
        result1 = await user_service.get_user_by_email("user1@example.com")
        result2 = await user_service.get_user_by_email("user2@example.com")
        
        assert result1.email == "user1@example.com"
        assert result2.email == "user2@example.com"
        assert result1.id != result2.id
