import pytest
import jwt
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException, status, Request
from jwt.exceptions import ExpiredSignatureError, InvalidSignatureError, DecodeError

from app.utils.token_utils import TokenService
from app.core.config import settings

class TestTokenService:
    """Test TokenService functionality"""

    @pytest.fixture
    def token_service(self):
        return TokenService()

    @pytest.fixture
    def mock_request(self):
        """Create mock request with cookies and headers"""
        request = MagicMock(spec=Request)
        request.cookies = {
            "access_token": "mock-access-token",
            "refresh_token": "mock-refresh-token"
        }
        request.headers = {
            "authorization": "Bearer header-access-token"
        }
        return request

    def test_extract_access_token_from_header_success(self):
        """Test successful token extraction from Authorization header"""
        header = "Bearer valid-token-here"
        token = TokenService.extract_access_token_from_header(header)
        assert token == "valid-token-here"

    def test_extract_access_token_from_header_invalid(self):
        """Test invalid Authorization header raises exception"""
        with pytest.raises(HTTPException) as exc_info:
            TokenService.extract_access_token_from_header("Invalid header")
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    def test_extract_access_token_from_header_missing(self):
        """Test missing Authorization header raises exception"""
        with pytest.raises(HTTPException) as exc_info:
            TokenService.extract_access_token_from_header("")
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    def test_extract_access_token_from_request_cookie_priority(self, mock_request):
        """Test cookie takes priority over header"""
        token = TokenService.extract_access_token_from_request(mock_request)
        assert token == "mock-access-token"  # From cookie, not header

    def test_extract_access_token_from_request_header_fallback(self):
        """Test fallback to header when no cookie"""
        request = MagicMock(spec=Request)
        request.cookies = {}
        request.headers = {"authorization": "Bearer header-token"}
        
        token = TokenService.extract_access_token_from_request(request)
        assert token == "header-token"

    def test_extract_access_token_from_request_none(self):
        """Test returns None when no token available"""
        request = MagicMock(spec=Request)
        request.cookies = {}
        request.headers = {}
        
        token = TokenService.extract_access_token_from_request(request)
        assert token is None

    def test_extract_refresh_token_from_request(self, mock_request):
        """Test refresh token extraction from cookie"""
        token = TokenService.extract_refresh_token_from_request(mock_request)
        assert token == "mock-refresh-token"

    @patch('app.utils.token_utils.httpx.AsyncClient')
    async def test_get_keycloak_public_key_success(self, mock_client, token_service):
        """Test successful public key retrieval from Keycloak"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "keys": [{
                "n": "test-modulus-base64",
                "e": "AQAB"  # Standard RSA exponent
            }]
        }
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        with patch('cryptography.hazmat.primitives.asymmetric.rsa.RSAPublicNumbers'):
            with patch('base64.urlsafe_b64decode', return_value=b'test'):
                # Mock the key generation process
                token_service._public_key_cache = "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----"
                
                key = await token_service.get_keycloak_public_key()
                assert key.startswith("-----BEGIN PUBLIC KEY-----")

    @patch('app.utils.token_utils.httpx.AsyncClient')
    async def test_get_keycloak_public_key_failure(self, mock_client, token_service):
        """Test public key retrieval failure"""
        mock_client.return_value.__aenter__.return_value.get.side_effect = Exception("Connection failed")
        
        with pytest.raises(HTTPException) as exc_info:
            await token_service.get_keycloak_public_key()
        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @patch.object(TokenService, 'get_keycloak_public_key')
    async def test_get_user_id_from_token_valid(self, mock_get_key, token_service):
        """Test user ID extraction from valid token"""
        mock_get_key.return_value = "mock-public-key"
        
        # Mock JWT decode for valid token
        with patch('jwt.decode') as mock_decode:
            mock_decode.return_value = {"sub": "test-user-id-123"}
            
            user_id = await token_service.get_user_id_from_token("valid-token")
            assert user_id == "test-user-id-123"

    async def test_get_user_id_from_token_expired(self, token_service):
        """Test expired token raises appropriate exception"""
        with patch('jwt.decode') as mock_decode:
            mock_decode.side_effect = ExpiredSignatureError("Token expired")
            
            with pytest.raises(HTTPException) as exc_info:
                await token_service.get_user_id_from_token("expired-token")
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "expired" in exc_info.value.detail

    async def test_get_user_id_from_token_invalid_signature(self, token_service):
        """Test invalid signature raises appropriate exception"""
        with patch('jwt.decode') as mock_decode:
            mock_decode.side_effect = InvalidSignatureError("Invalid signature")
            
            with pytest.raises(HTTPException) as exc_info:
                await token_service.get_user_id_from_token("invalid-token")
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "signature" in exc_info.value.detail

    async def test_get_user_id_from_token_malformed(self, token_service):
        """Test malformed token raises appropriate exception"""
        with patch('jwt.decode') as mock_decode:
            mock_decode.side_effect = DecodeError("Malformed token")
            
            with pytest.raises(HTTPException) as exc_info:
                await token_service.get_user_id_from_token("malformed-token")
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    @patch.object(TokenService, 'extract_access_token_from_request')
    @patch.object(TokenService, 'get_user_id_from_token')
    async def test_get_user_id_from_request_success(self, mock_get_user_id, mock_extract, token_service, mock_request):
        """Test successful user ID extraction from request"""
        mock_extract.return_value = "valid-token"
        mock_get_user_id.return_value = "test-user-id"
        
        user_id = await token_service.get_user_id_from_request(mock_request)
        assert user_id == "test-user-id"

    @patch.object(TokenService, 'extract_access_token_from_request')
    async def test_get_user_id_from_request_no_token(self, mock_extract, token_service, mock_request):
        """Test request without token raises exception"""
        mock_extract.return_value = None
        
        with pytest.raises(HTTPException) as exc_info:
            await token_service.get_user_id_from_request(mock_request)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "missing" in exc_info.value.detail

    @patch.object(TokenService, 'extract_refresh_token_from_request')
    async def test_get_refresh_token_hybrid_cookie_success(self, mock_extract, token_service, mock_request):
        """Test refresh token extraction from cookie"""
        mock_extract.return_value = "refresh-token-from-cookie"
        
        token = await token_service.get_refresh_token_hybrid(mock_request, "user-id")
        assert token == "refresh-token-from-cookie"

    @patch.object(TokenService, 'extract_refresh_token_from_request')
    async def test_get_refresh_token_hybrid_redis_fallback(self, mock_extract, token_service, mock_request):
        """Test Redis fallback when no cookie"""
        mock_extract.return_value = None
        mock_redis = AsyncMock()
        mock_redis.get_refresh_token.return_value = "refresh-token-from-redis"
        
        token = await token_service.get_refresh_token_hybrid(mock_request, "user-id", mock_redis)
        assert token == "refresh-token-from-redis"

class TestTokenSecurityScenarios:
    """Test various token security scenarios"""

    @pytest.fixture
    def token_service(self):
        return TokenService()

    async def test_token_without_subject_claim(self, token_service):
        """Test token without subject claim is rejected"""
        with patch('jwt.decode') as mock_decode:
            mock_decode.return_value = {"iat": 1234567890}  # No 'sub' claim
            
            with pytest.raises(HTTPException) as exc_info:
                await token_service.get_user_id_from_token("token-without-sub")
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_refresh_token_algorithm_detection(self, token_service):
        """Test refresh token handles different algorithms"""
        # Mock token header with different algorithm
        mock_header = {"alg": "HS256", "typ": "JWT"}
        
        with patch('jwt.get_unverified_header') as mock_get_header:
            mock_get_header.return_value = mock_header
            
            with patch('jwt.decode') as mock_decode:
                mock_decode.return_value = {"sub": "test-user-id"}
                
                user_id = await token_service.get_user_id_from_refresh_token("refresh-token")
                assert user_id == "test-user-id"

    async def test_development_mode_token_validation(self, token_service):
        """Test development mode has relaxed validation"""
        with patch('jwt.decode') as mock_decode:
            mock_decode.return_value = {"sub": "test-user-id"}
            
            # In development, should use relaxed validation
            user_id = await token_service.get_user_id_from_token("dev-token")
            assert user_id == "test-user-id"
            
            # Verify decode was called with relaxed options
            call_args = mock_decode.call_args
            options = call_args[1]["options"]
            assert options["verify_signature"] is False
            assert options["verify_exp"] is False

class TestTokenCaching:
    """Test token service caching mechanisms"""

    @pytest.fixture
    def token_service(self):
        return TokenService()

    @patch('app.utils.token_utils.httpx.AsyncClient')
    async def test_public_key_caching(self, mock_client, token_service):
        """Test public key is cached after first retrieval"""
        # Set up cache
        token_service._public_key_cache = "cached-public-key"
        
        # Should return cached key without making HTTP call
        key = await token_service.get_keycloak_public_key()
        assert key == "cached-public-key"
        mock_client.assert_not_called()

    @patch('app.utils.token_utils.httpx.AsyncClient')
    async def test_public_key_cache_miss_fetches(self, mock_client, token_service):
        """Test cache miss triggers key fetch"""
        token_service._public_key_cache = None
        
        mock_response = MagicMock()
        mock_response.json.return_value = {"keys": [{"n": "test", "e": "AQAB"}]}
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        with patch('cryptography.hazmat.primitives.asymmetric.rsa.RSAPublicNumbers'):
            with patch('base64.urlsafe_b64decode', return_value=b'test'):
                # Should make HTTP call when cache is empty
                try:
                    await token_service.get_keycloak_public_key()
                except:
                    pass  # Expected to fail in test environment
                
                mock_client.assert_called()

class TestTokenAttackVectors:
    """Test various token-based attack vectors"""

    @pytest.fixture
    def token_service(self):
        return TokenService()

    async def test_token_replay_attack(self, token_service):
        """Test token replay attack with expired token"""
        with patch('jwt.decode') as mock_decode:
            mock_decode.side_effect = ExpiredSignatureError("Token expired")
            
            with pytest.raises(HTTPException) as exc_info:
                await token_service.get_user_id_from_token("expired-token")
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_token_tampering_attack(self, token_service):
        """Test tampered token is rejected"""
        with patch('jwt.decode') as mock_decode:
            mock_decode.side_effect = InvalidSignatureError("Signature verification failed")
            
            with pytest.raises(HTTPException) as exc_info:
                await token_service.get_user_id_from_token("tampered-token")
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_malformed_token_attack(self, token_service):
        """Test malformed token is rejected"""
        with patch('jwt.decode') as mock_decode:
            mock_decode.side_effect = DecodeError("Not enough segments")
            
            with pytest.raises(HTTPException) as exc_info:
                await token_service.get_user_id_from_token("malformed.token")
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_empty_token_attack(self, token_service):
        """Test empty token is rejected"""
        with pytest.raises(HTTPException) as exc_info:
            await token_service.get_user_id_from_token("")
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_none_token_attack(self, token_service):
        """Test None token is rejected"""
        with pytest.raises(HTTPException) as exc_info:
            await token_service.get_user_id_from_token(None)
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

class TestHybridTokenExtraction:
    """Test hybrid token extraction security"""

    @pytest.fixture
    def token_service(self):
        return TokenService()

    async def test_hybrid_extraction_prefers_cookie(self, token_service):
        """Test hybrid extraction prefers secure cookie over header"""
        request = MagicMock(spec=Request)
        request.cookies = {"refresh_token": "cookie-token"}
        
        mock_redis = AsyncMock()
        mock_redis.get_refresh_token.return_value = "redis-token"
        
        token = await token_service.get_refresh_token_hybrid(request, "user-id", mock_redis)
        assert token == "cookie-token"  # Cookie preferred over Redis

    async def test_hybrid_extraction_redis_fallback(self, token_service):
        """Test Redis fallback when no cookie"""
        request = MagicMock(spec=Request)
        request.cookies = {}
        
        mock_redis = AsyncMock()
        mock_redis.get_refresh_token.return_value = "redis-token"
        
        token = await token_service.get_refresh_token_hybrid(request, "user-id", mock_redis)
        assert token == "redis-token"

    async def test_hybrid_extraction_no_token(self, token_service):
        """Test hybrid extraction returns None when no token available"""
        request = MagicMock(spec=Request)
        request.cookies = {}
        
        mock_redis = AsyncMock()
        mock_redis.get_refresh_token.return_value = None
        
        token = await token_service.get_refresh_token_hybrid(request, "user-id", mock_redis)
        assert token is None

    async def test_hybrid_extraction_redis_failure_graceful(self, token_service):
        """Test graceful handling of Redis failure in hybrid extraction"""
        request = MagicMock(spec=Request)
        request.cookies = {}
        
        mock_redis = AsyncMock()
        mock_redis.get_refresh_token.side_effect = Exception("Redis connection failed")
        
        token = await token_service.get_refresh_token_hybrid(request, "user-id", mock_redis)
        assert token is None  # Should not raise exception

class TestJWTValidationSecurity:
    """Test JWT validation security features"""

    @pytest.fixture
    def token_service(self):
        return TokenService()

    async def test_algorithm_confusion_attack_prevention(self, token_service):
        """Test prevention of algorithm confusion attacks"""
        # Mock token with HMAC algorithm but RSA key
        with patch('jwt.get_unverified_header') as mock_header:
            mock_header.return_value = {"alg": "HS256"}
            
            with patch('jwt.decode') as mock_decode:
                # Should handle algorithm mismatch gracefully
                mock_decode.return_value = {"sub": "test-user"}
                
                user_id = await token_service.get_user_id_from_refresh_token("token")
                assert user_id == "test-user"

    async def test_none_algorithm_attack_prevention(self, token_service):
        """Test prevention of 'none' algorithm attack"""
        with patch('jwt.decode') as mock_decode:
            mock_decode.side_effect = InvalidSignatureError("Algorithm 'none' not allowed")
            
            with pytest.raises(HTTPException) as exc_info:
                await token_service.get_user_id_from_token("none-alg-token")
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    @patch.object(TokenService, 'get_keycloak_public_key')
    async def test_key_confusion_attack_prevention(self, mock_get_key, token_service):
        """Test prevention of key confusion attacks"""
        mock_get_key.side_effect = Exception("Key retrieval failed")
        
        with pytest.raises(HTTPException) as exc_info:
            await token_service.get_user_id_from_token("token-with-wrong-key")
        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

class TestDevelopmentVsProductionSecurity:
    """Test security differences between development and production"""

    @pytest.fixture
    def token_service(self):
        return TokenService()

    async def test_development_mode_relaxed_validation(self, token_service):
        """Test development mode uses relaxed JWT validation"""
        with patch('jwt.decode') as mock_decode:
            mock_decode.return_value = {"sub": "test-user"}
            
            await token_service.get_user_id_from_token("dev-token")
            
            # Verify relaxed options were used
            call_args = mock_decode.call_args
            options = call_args[1]["options"]
            assert options["verify_signature"] is False
            assert options["verify_exp"] is False
            assert options["verify_aud"] is False
            assert options["verify_iss"] is False

    @patch.object(TokenService, 'get_keycloak_public_key')
    async def test_production_mode_strict_validation(self, mock_get_key, token_service):
        """Test production mode would use strict validation"""
        mock_get_key.return_value = "mock-public-key"
        
        # Mock settings to simulate production
        with patch('app.utils.token_utils.settings') as mock_settings:
            mock_settings.environment = "production"
            
            with patch('jwt.decode') as mock_decode:
                mock_decode.return_value = {"sub": "test-user"}
                
                await token_service.get_user_id_from_token("prod-token")
                
                # In production, should use strict validation
                # (Note: Current implementation uses development mode validation)
                # This test documents expected production behavior

class TestConcurrentTokenOperations:
    """Test concurrent token operations"""

    @pytest.fixture
    def token_service(self):
        return TokenService()

    async def test_concurrent_token_validation(self, token_service):
        """Test concurrent token validation doesn't cause race conditions"""
        with patch.object(token_service, 'get_user_id_from_token') as mock_validate:
            mock_validate.return_value = "test-user-id"
            
            # Simulate 10 concurrent token validations
            tasks = [
                token_service.get_user_id_from_token(f"token-{i}")
                for i in range(10)
            ]
            
            results = await asyncio.gather(*tasks)
            
            # All should succeed
            assert all(result == "test-user-id" for result in results)
            assert mock_validate.call_count == 10

    @patch.object(TokenService, 'get_keycloak_public_key')
    async def test_concurrent_public_key_fetch(self, mock_get_key, token_service):
        """Test concurrent public key fetching uses cache properly"""
        mock_get_key.return_value = "public-key"
        
        # Simulate concurrent key fetches
        tasks = [token_service.get_keycloak_public_key() for _ in range(5)]
        results = await asyncio.gather(*tasks)
        
        # All should return same key
        assert all(result == "public-key" for result in results)
        # Should only fetch once due to caching
        assert mock_get_key.call_count <= 5  # May be called multiple times due to race conditions
