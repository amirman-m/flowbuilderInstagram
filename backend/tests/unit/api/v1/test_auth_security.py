import pytest
import time
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import FastAPI, status, HTTPException
from fastapi.testclient import TestClient

from app.api.v1.auth import router as auth_router
from app.models.user import User

# Create test app
app = FastAPI()
app.include_router(auth_router, prefix="/auth")
client = TestClient(app)

class TestBruteForceAttacks:
    """Test brute force attack scenarios"""

    async def test_login_brute_force_10_rapid_requests(self):
        """Test 10 rapid login requests trigger rate limiting"""
        invalid_creds = {"email": "victim@example.com", "password": "wrong"}
        
        with patch('app.api.v1.auth.multi_layer_rate_limit') as mock_rate_limit:
            call_count = 0
            def rate_limit_side_effect(limit_type, clear_on_success=False):
                nonlocal call_count
                call_count += 1
                if call_count > 5:  # After 5 attempts, start blocking
                    def blocking_decorator(func):
                        def wrapper(*args, **kwargs):
                            raise HTTPException(
                                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                                detail="Rate limit exceeded"
                            )
                        return wrapper
                    return blocking_decorator
                else:
                    return lambda func: func
            
            mock_rate_limit.side_effect = rate_limit_side_effect
            
            with patch('app.api.v1.auth.keycloak_service') as mock_keycloak:
                mock_keycloak.authenticate_user.return_value = {"success": False}
                
                responses = []
                for i in range(10):
                    response = client.post("/auth/login", json=invalid_creds)
                    responses.append(response.status_code)
                
                # First 5 should be 401, last 5 should be 429
                assert responses[:5] == [401] * 5
                assert responses[5:] == [429] * 5

    async def test_registration_spam_blocked(self):
        """Test registration spam is blocked by rate limiting"""
        with patch('app.api.v1.auth.multi_layer_rate_limit') as mock_rate_limit:
            def rate_limit_exceeded(func):
                def wrapper(*args, **kwargs):
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Registration rate limit exceeded"
                    )
                return wrapper
            
            mock_rate_limit.return_value = rate_limit_exceeded
            
            responses = []
            for i in range(5):
                response = client.post("/auth/register", json={
                    "email": f"spam{i}@example.com",
                    "password": "password",
                    "name": "Spammer"
                })
                responses.append(response.status_code)
            
            assert all(status_code == 429 for status_code in responses)

class TestInjectionAttacks:
    """Test injection attack prevention"""

    async def test_sql_injection_blocked(self):
        """Test SQL injection attempts are blocked"""
        sql_payloads = [
            "test'; DROP TABLE users; --",
            "test' OR '1'='1",
            "test' UNION SELECT * FROM users --"
        ]
        
        for payload in sql_payloads:
            response = client.post("/auth/register", json={
                "email": payload,
                "password": "password",
                "name": "Attacker"
            })
            # Should be blocked by email validation
            assert response.status_code in [422, 400]

    async def test_xss_injection_sanitized(self):
        """Test XSS injection is sanitized"""
        xss_payloads = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>"
        ]
        
        for payload in xss_payloads:
            with patch('app.api.v1.auth.multi_layer_rate_limit') as mock_rate_limit:
                mock_rate_limit.return_value = lambda func: func
                
                response = client.post("/auth/register", json={
                    "email": "test@example.com",
                    "password": "password",
                    "name": payload
                })
                
                # Even if accepted, XSS should not be in response
                if response.status_code == 201:
                    assert payload not in str(response.json())

class TestTokenAttacks:
    """Test token-based attacks"""

    async def test_jwt_none_algorithm_blocked(self):
        """Test JWT 'none' algorithm attack is blocked"""
        import base64
        import json
        
        header = base64.b64encode(json.dumps({"alg": "none"}).encode()).decode()
        payload = base64.b64encode(json.dumps({"sub": "attacker"}).encode()).decode()
        malicious_token = f"{header}.{payload}."
        
        with patch('app.api.v1.auth.token_service') as mock_token_service:
            mock_token_service.extract_access_token_from_request.return_value = malicious_token
            mock_token_service.get_user_id_from_token.side_effect = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
            
            client.cookies.set("access_token", malicious_token)
            response = client.post("/auth/logout")
            assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_expired_token_blocked(self):
        """Test expired tokens are blocked"""
        with patch('app.api.v1.auth.token_service') as mock_token_service:
            mock_token_service.extract_access_token_from_request.return_value = "expired-token"
            mock_token_service.get_user_id_from_token.side_effect = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
            
            response = client.post("/auth/logout")
            assert response.status_code == status.HTTP_401_UNAUTHORIZED

class TestCookieSecurity:
    """Test cookie security implementation"""

    @patch('app.api.v1.auth.keycloak_service')
    @patch('app.api.v1.auth.redis_service')
    @patch('app.api.v1.auth.multi_layer_rate_limit')
    async def test_httponly_cookies_set(self, mock_rate_limit, mock_redis, mock_keycloak):
        """Test HttpOnly cookies are properly set"""
        mock_rate_limit.return_value = lambda func: func
        mock_keycloak.authenticate_user.return_value = {
            "success": True,
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 300
        }
        mock_redis.store_refresh_token.return_value = True
        mock_redis.store_access_token.return_value = True
        
        with patch('app.api.v1.auth.get_user_service') as mock_get_service:
            mock_service = AsyncMock()
            mock_user = User(id=1, email="test@example.com", keycloak_id="test-id", is_active=True)
            mock_service.get_user_by_email.return_value = mock_user
            mock_get_service.return_value = mock_service
            
            response = client.post("/auth/login", json={
                "email": "test@example.com",
                "password": "password"
            })
            
            # Verify HttpOnly and security attributes
            assert response.cookies["access_token"]["httponly"] is True
            assert response.cookies["refresh_token"]["httponly"] is True
            assert response.cookies["refresh_token"]["path"] == "/auth/refresh"

class TestResourceExhaustion:
    """Test resource exhaustion attack prevention"""

    async def test_large_payload_rejected(self):
        """Test oversized payloads are rejected"""
        large_data = {
            "email": "test@example.com",
            "password": "A" * 100000,  # 100KB password
            "name": "B" * 50000        # 50KB name
        }
        
        response = client.post("/auth/register", json=large_data)
        assert response.status_code in [413, 422]

    async def test_rapid_requests_blocked(self):
        """Test rapid requests are blocked by rate limiting"""
        with patch('app.api.v1.auth.multi_layer_rate_limit') as mock_rate_limit:
            call_count = 0
            def rate_limit_side_effect(limit_type, clear_on_success=False):
                nonlocal call_count
                call_count += 1
                if call_count > 2:
                    def blocking_decorator(func):
                        def wrapper(*args, **kwargs):
                            raise HTTPException(
                                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                                detail="Too many requests"
                            )
                        return wrapper
                    return blocking_decorator
                return lambda func: func
            
            mock_rate_limit.side_effect = rate_limit_side_effect
            
            responses = []
            for i in range(5):
                response = client.post("/auth/login", json={
                    "email": "test@example.com",
                    "password": "password"
                })
                responses.append(response.status_code)
            
            # Later requests should be rate limited
            assert 429 in responses

class TestDataValidation:
    """Test data validation security"""

    async def test_email_format_validation(self):
        """Test email format validation blocks invalid emails"""
        invalid_emails = [
            "not-an-email",
            "@example.com",
            "test@",
            "test..test@example.com",
            "test@example",
            ""
        ]
        
        for email in invalid_emails:
            response = client.post("/auth/register", json={
                "email": email,
                "password": "password",
                "name": "Test"
            })
            assert response.status_code == 422

    async def test_password_requirements(self):
        """Test password requirements are enforced"""
        weak_passwords = [
            "",
            "123",
            "password",
            "abc"
        ]
        
        for password in weak_passwords:
            response = client.post("/auth/register", json={
                "email": "test@example.com",
                "password": password,
                "name": "Test"
            })
            # Should be rejected by validation
            assert response.status_code in [422, 400]

class TestErrorHandling:
    """Test comprehensive error handling"""

    @patch('app.api.v1.auth.keycloak_service')
    async def test_service_exception_handling(self, mock_keycloak):
        """Test service exceptions are properly handled"""
        mock_keycloak.authenticate_user.side_effect = Exception("Unexpected error")
        
        with patch('app.api.v1.auth.multi_layer_rate_limit') as mock_rate_limit:
            mock_rate_limit.return_value = lambda func: func
            
            response = client.post("/auth/login", json={
                "email": "test@example.com",
                "password": "password"
            })
            
            assert response.status_code == 500
            # Should not expose internal error details
            assert "Unexpected error" not in response.json()["detail"]
