import pytest
import time
import json
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException, status, Request

from app.utils.rate_limiter import (
    MultiLayerRateLimiter,
    multi_layer_rate_limit,
    check_email_rate_limit,
    analyze_rate_limit_patterns,
    ip_key,
    subnet_key,
    user_agent_fingerprint_key,
    endpoint_key,
    email_key,
    RATE_LIMIT_CONFIGS
)

class TestMultiLayerRateLimiter:
    """Test MultiLayerRateLimiter class functionality"""

    @pytest.fixture
    def rate_limiter(self):
        return MultiLayerRateLimiter()

    @pytest.fixture
    def mock_request(self):
        """Create mock request object"""
        request = MagicMock(spec=Request)
        request.client.host = "192.168.1.100"
        request.headers = {"user-agent": "Mozilla/5.0 Test Browser"}
        request.url.path = "/auth/login"
        return request

    @patch('app.utils.rate_limiter.redis_service')
    async def test_first_attempt_not_blocked(self, mock_redis, rate_limiter):
        """Test first attempt is not rate limited"""
        mock_redis.redis_client.get.return_value = None
        mock_redis.redis_client.setex.return_value = True
        
        result = await rate_limiter.is_rate_limited("test_key", 5, 300)
        
        assert result["blocked"] is False
        assert result["attempts"] == 1
        assert result["remaining"] == 4

    @patch('app.utils.rate_limiter.redis_service')
    async def test_within_threshold_not_blocked(self, mock_redis, rate_limiter):
        """Test attempts within threshold are not blocked"""
        current_time = time.time()
        attempt_data = {
            "attempts": 3,
            "first_attempt": current_time,
            "last_attempt": current_time
        }
        mock_redis.redis_client.get.return_value = json.dumps(attempt_data)
        mock_redis.redis_client.setex.return_value = True
        
        result = await rate_limiter.is_rate_limited("test_key", 5, 300)
        
        assert result["blocked"] is False
        assert result["attempts"] == 4
        assert result["remaining"] == 1

    @patch('app.utils.rate_limiter.redis_service')
    async def test_threshold_exceeded_blocked(self, mock_redis, rate_limiter):
        """Test attempts exceeding threshold are blocked"""
        current_time = time.time()
        attempt_data = {
            "attempts": 5,
            "first_attempt": current_time,
            "last_attempt": current_time
        }
        mock_redis.redis_client.get.return_value = json.dumps(attempt_data)
        mock_redis.redis_client.setex.return_value = True
        
        result = await rate_limiter.is_rate_limited("test_key", 5, 300)
        
        assert result["blocked"] is True
        assert result["attempts"] == 6
        assert "remaining_time" in result
        assert result["remaining_time"] > 0

    @patch('app.utils.rate_limiter.redis_service')
    async def test_window_expiration_resets_counter(self, mock_redis, rate_limiter):
        """Test expired window resets attempt counter"""
        old_time = time.time() - 400  # 400 seconds ago (window is 300)
        attempt_data = {
            "attempts": 10,
            "first_attempt": old_time,
            "last_attempt": old_time
        }
        mock_redis.redis_client.get.return_value = json.dumps(attempt_data)
        mock_redis.redis_client.setex.return_value = True
        
        result = await rate_limiter.is_rate_limited("test_key", 5, 300)
        
        assert result["blocked"] is False
        assert result["attempts"] == 1  # Reset to 1
        assert result["remaining"] == 4

    @patch('app.utils.rate_limiter.redis_service')
    async def test_redis_failure_fails_open(self, mock_redis, rate_limiter):
        """Test Redis failure fails open (doesn't block)"""
        mock_redis.redis_client.get.side_effect = Exception("Redis connection failed")
        
        result = await rate_limiter.is_rate_limited("test_key", 5, 300)
        
        # Should fail open and not block
        assert result["blocked"] is False
        assert result["attempts"] == 1

    @patch('app.utils.rate_limiter.redis_service')
    async def test_clear_rate_limit(self, mock_redis, rate_limiter):
        """Test clearing rate limit"""
        mock_redis.redis_client.delete.return_value = 1
        
        await rate_limiter.clear_rate_limit("test_key")
        
        mock_redis.redis_client.delete.assert_called_once_with("rate_limit:test_key")

    @patch('app.utils.rate_limiter.redis_service')
    async def test_multiple_limits_check(self, mock_redis, rate_limiter, mock_request):
        """Test checking multiple rate limits simultaneously"""
        # Mock different rate limit results
        mock_redis.redis_client.get.side_effect = [
            None,  # IP limit - first attempt
            json.dumps({"attempts": 2, "first_attempt": time.time(), "last_attempt": time.time()}),  # Subnet limit
            None   # Endpoint limit - first attempt
        ]
        mock_redis.redis_client.setex.return_value = True
        
        limits = [
            {"name": "ip_limit", "key_func": ip_key, "max_attempts": 5, "window_seconds": 300},
            {"name": "subnet_limit", "key_func": lambda r: subnet_key(r, 24), "max_attempts": 10, "window_seconds": 300},
            {"name": "endpoint_limit", "key_func": endpoint_key, "max_attempts": 20, "window_seconds": 300}
        ]
        
        result = await rate_limiter.check_multiple_limits(mock_request, limits)
        
        assert result["blocked"] is False
        assert len(result["limits_checked"]) == 3

class TestRateLimitKeyGeneration:
    """Test rate limit key generation functions"""

    @pytest.fixture
    def mock_request(self):
        request = MagicMock(spec=Request)
        request.client.host = "192.168.1.100"
        request.headers = {"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        request.url.path = "/auth/login"
        return request

    def test_ip_key_generation(self, mock_request):
        """Test IP-based key generation"""
        key = ip_key(mock_request)
        assert key == "ip:192.168.1.100"

    def test_subnet_key_generation(self, mock_request):
        """Test subnet-based key generation"""
        key = subnet_key(mock_request, 24)
        assert key == "subnet:192.168.1.0/24"

    def test_user_agent_fingerprint_key(self, mock_request):
        """Test user agent fingerprint key generation"""
        key = user_agent_fingerprint_key(mock_request)
        assert key.startswith("fingerprint:")
        assert len(key.split(":")[1]) == 64  # SHA256 hash length

    def test_endpoint_key_generation(self, mock_request):
        """Test endpoint-based key generation"""
        key = endpoint_key(mock_request)
        assert key == "endpoint:192.168.1.100:/auth/login"

    def test_email_key_generation(self):
        """Test email-based key generation"""
        key = email_key("test@example.com")
        assert key == "email:test@example.com"

class TestEmailRateLimiting:
    """Test email-specific rate limiting"""

    @patch('app.utils.rate_limiter.multi_rate_limiter')
    async def test_email_rate_limit_not_exceeded(self, mock_limiter):
        """Test email rate limit when not exceeded"""
        mock_limiter.is_rate_limited.return_value = {"blocked": False, "attempts": 2}
        
        # Should not raise exception
        await check_email_rate_limit("test@example.com", 5, 300)

    @patch('app.utils.rate_limiter.multi_rate_limiter')
    async def test_email_rate_limit_exceeded(self, mock_limiter):
        """Test email rate limit when exceeded"""
        mock_limiter.is_rate_limited.return_value = {
            "blocked": True,
            "remaining_time": 250,
            "attempts": 6
        }
        
        with pytest.raises(HTTPException) as exc_info:
            await check_email_rate_limit("test@example.com", 5, 300)
        
        assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "Too many attempts for this email address" in str(exc_info.value.detail)

    @patch('app.utils.rate_limiter.multi_rate_limiter')
    async def test_email_rate_limit_redis_failure_fails_open(self, mock_limiter):
        """Test email rate limiting fails open when Redis is unavailable"""
        mock_limiter.is_rate_limited.side_effect = Exception("Redis connection failed")
        
        # Should not raise exception (fails open)
        await check_email_rate_limit("test@example.com", 5, 300)

class TestRateLimitConfigurations:
    """Test rate limit configuration validity"""

    def test_production_config_exists(self):
        """Test production rate limit configuration exists"""
        assert "production" in RATE_LIMIT_CONFIGS
        assert "registration" in RATE_LIMIT_CONFIGS["production"]
        assert "login" in RATE_LIMIT_CONFIGS["production"]
        assert "refresh" in RATE_LIMIT_CONFIGS["production"]

    def test_staging_config_exists(self):
        """Test staging rate limit configuration exists"""
        assert "staging" in RATE_LIMIT_CONFIGS
        assert "registration" in RATE_LIMIT_CONFIGS["staging"]
        assert "login" in RATE_LIMIT_CONFIGS["staging"]

    def test_development_config_exists(self):
        """Test development rate limit configuration exists"""
        assert "development" in RATE_LIMIT_CONFIGS
        assert "registration" in RATE_LIMIT_CONFIGS["development"]
        assert "login" in RATE_LIMIT_CONFIGS["development"]

    def test_production_limits_are_restrictive(self):
        """Test production limits are appropriately restrictive"""
        prod_config = RATE_LIMIT_CONFIGS["production"]
        
        # Registration should be very restrictive
        reg_limits = prod_config["registration"]
        ip_limit = next(limit for limit in reg_limits if limit["name"] == "reg_per_ip")
        assert ip_limit["max_attempts"] <= 3  # Should be very low
        assert ip_limit["window_seconds"] >= 300  # Should be at least 5 minutes
        
        # Login should be moderately restrictive
        login_limits = prod_config["login"]
        login_ip_limit = next(limit for limit in login_limits if limit["name"] == "login_per_ip")
        assert login_ip_limit["max_attempts"] <= 10
        assert login_ip_limit["window_seconds"] >= 300

    def test_development_limits_are_permissive(self):
        """Test development limits are more permissive"""
        dev_config = RATE_LIMIT_CONFIGS["development"]
        
        # Development should be more permissive than production
        reg_limits = dev_config["registration"]
        ip_limit = next(limit for limit in reg_limits if limit["name"] == "reg_per_ip")
        assert ip_limit["max_attempts"] >= 5  # More permissive than production

class TestRateLimitPatternAnalysis:
    """Test rate limit pattern analysis for security monitoring"""

    @patch('app.utils.rate_limiter.redis_service')
    async def test_analyze_suspicious_patterns(self, mock_redis):
        """Test analysis of suspicious rate limit patterns"""
        # Mock Redis keys with suspicious activity
        mock_keys = [
            "rate_limit:ip:192.168.1.100:login",
            "rate_limit:ip:192.168.1.101:login",
            "rate_limit:subnet:192.168.1.0/24:login",
            "rate_limit:fingerprint:abc123def456:login"
        ]
        
        mock_data = [
            json.dumps({"attempts": 60, "first_attempt": time.time()}),  # Suspicious IP
            json.dumps({"attempts": 15, "first_attempt": time.time()}),  # Normal IP
            json.dumps({"attempts": 250, "first_attempt": time.time()}), # High traffic subnet
            json.dumps({"attempts": 25, "first_attempt": time.time()})   # Blocked fingerprint
        ]
        
        mock_redis.redis_client.keys.return_value = mock_keys
        mock_redis.redis_client.get.side_effect = mock_data
        
        analysis = await analyze_rate_limit_patterns()
        
        assert analysis["total_active_limits"] == 4
        assert len(analysis["suspicious_ips"]) == 1
        assert analysis["suspicious_ips"][0]["ip"] == "192.168.1.100"
        assert len(analysis["high_traffic_subnets"]) == 1
        assert len(analysis["blocked_fingerprints"]) == 1

    @patch('app.utils.rate_limiter.redis_service')
    async def test_analyze_patterns_redis_failure(self, mock_redis):
        """Test pattern analysis handles Redis failure gracefully"""
        mock_redis.redis_client.keys.side_effect = Exception("Redis connection failed")
        
        analysis = await analyze_rate_limit_patterns()
        
        assert "error" in analysis
        assert "timestamp" in analysis

class TestRateLimitDecorator:
    """Test rate limit decorator functionality"""

    @pytest.fixture
    def mock_request(self):
        request = MagicMock(spec=Request)
        request.client.host = "192.168.1.100"
        request.headers = {"user-agent": "Mozilla/5.0 Test Browser"}
        request.url.path = "/auth/login"
        return request

    @patch('app.utils.rate_limiter.multi_rate_limiter')
    async def test_decorator_allows_within_limits(self, mock_limiter, mock_request):
        """Test decorator allows requests within rate limits"""
        mock_limiter.check_multiple_limits.return_value = {"blocked": False}
        
        @multi_layer_rate_limit("login", clear_on_success=False)
        async def test_endpoint(request: Request):
            return {"success": True}
        
        result = await test_endpoint(mock_request)
        assert result["success"] is True

    @patch('app.utils.rate_limiter.multi_rate_limiter')
    async def test_decorator_blocks_exceeded_limits(self, mock_limiter, mock_request):
        """Test decorator blocks requests exceeding rate limits"""
        mock_limiter.check_multiple_limits.return_value = {
            "blocked": True,
            "blocked_by": "ip_limit",
            "remaining_time": 250,
            "max_attempts": 5
        }
        
        @multi_layer_rate_limit("login", clear_on_success=False)
        async def test_endpoint(request: Request):
            return {"success": True}
        
        with pytest.raises(HTTPException) as exc_info:
            await test_endpoint(mock_request)
        
        assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        detail = exc_info.value.detail
        assert detail["message"] == "Rate limit exceeded"
        assert detail["blocked_by"] == "ip_limit"
        assert detail["remaining_time"] == 250

    @patch('app.utils.rate_limiter.multi_rate_limiter')
    async def test_decorator_clears_on_success(self, mock_limiter, mock_request):
        """Test decorator clears rate limits on successful operation"""
        mock_limiter.check_multiple_limits.return_value = {"blocked": False}
        mock_limiter.clear_multiple_rate_limits.return_value = None
        
        @multi_layer_rate_limit("login", clear_on_success=True)
        async def test_endpoint(request: Request):
            return {"success": True}
        
        result = await test_endpoint(mock_request)
        assert result["success"] is True
        mock_limiter.clear_multiple_rate_limits.assert_called_once()

class TestAttackScenarios:
    """Test various attack scenarios against rate limiter"""

    @pytest.fixture
    def rate_limiter(self):
        return MultiLayerRateLimiter()

    @patch('app.utils.rate_limiter.redis_service')
    async def test_distributed_brute_force_attack(self, mock_redis, rate_limiter):
        """Test distributed brute force attack from multiple IPs"""
        # Simulate attacks from different IPs in same subnet
        ips = ["192.168.1.100", "192.168.1.101", "192.168.1.102"]
        
        for ip in ips:
            # Each IP makes maximum allowed attempts
            attempt_data = {
                "attempts": 5,
                "first_attempt": time.time(),
                "last_attempt": time.time()
            }
            mock_redis.redis_client.get.return_value = json.dumps(attempt_data)
            
            result = await rate_limiter.is_rate_limited(f"ip:{ip}:login", 5, 300)
            assert result["blocked"] is True

    @patch('app.utils.rate_limiter.redis_service')
    async def test_user_agent_rotation_attack(self, mock_redis, rate_limiter):
        """Test attack using rotating user agents"""
        # Different user agents from same IP should still be limited by IP
        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1",
            "Mozilla/5.0 (X11; Linux x86_64) Firefox/89.0"
        ]
        
        # IP limit should catch this regardless of user agent rotation
        attempt_data = {
            "attempts": 10,
            "first_attempt": time.time(),
            "last_attempt": time.time()
        }
        mock_redis.redis_client.get.return_value = json.dumps(attempt_data)
        
        for ua in user_agents:
            result = await rate_limiter.is_rate_limited("ip:192.168.1.100:login", 5, 300)
            assert result["blocked"] is True

    async def test_email_enumeration_attack_blocked(self):
        """Test email enumeration attack is blocked by rate limiting"""
        emails = [
            "admin@example.com",
            "user@example.com", 
            "test@example.com",
            "support@example.com"
        ]
        
        with patch('app.utils.rate_limiter.multi_rate_limiter') as mock_limiter:
            # After a few attempts, should be rate limited
            mock_limiter.is_rate_limited.return_value = {
                "blocked": True,
                "remaining_time": 300
            }
            
            for email in emails:
                with pytest.raises(HTTPException) as exc_info:
                    await check_email_rate_limit(email, 3, 300)
                
                assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS

class TestRateLimitEnvironmentConfigs:
    """Test rate limit configurations for different environments"""

    def test_production_registration_limits(self):
        """Test production registration limits are restrictive"""
        prod_limits = RATE_LIMIT_CONFIGS["production"]["registration"]
        
        # Should have IP-based limits
        ip_limits = [limit for limit in prod_limits if "ip" in limit["name"]]
        assert len(ip_limits) > 0
        
        # IP limits should be very restrictive for registration
        for limit in ip_limits:
            assert limit["max_attempts"] <= 3
            assert limit["window_seconds"] >= 600  # At least 10 minutes

    def test_production_login_limits(self):
        """Test production login limits balance security and usability"""
        prod_limits = RATE_LIMIT_CONFIGS["production"]["login"]
        
        # Should have multiple layers
        assert len(prod_limits) >= 3
        
        # IP limits should be reasonable but secure
        ip_limits = [limit for limit in prod_limits if "ip" in limit["name"]]
        for limit in ip_limits:
            assert 5 <= limit["max_attempts"] <= 15
            assert limit["window_seconds"] >= 300

    def test_development_limits_more_permissive(self):
        """Test development limits are more permissive than production"""
        dev_reg = RATE_LIMIT_CONFIGS["development"]["registration"]
        prod_reg = RATE_LIMIT_CONFIGS["production"]["registration"]
        
        dev_ip_limit = next(limit for limit in dev_reg if limit["name"] == "reg_per_ip")
        prod_ip_limit = next(limit for limit in prod_reg if limit["name"] == "reg_per_ip")
        
        # Development should allow more attempts
        assert dev_ip_limit["max_attempts"] > prod_ip_limit["max_attempts"]

class TestSecurityMonitoring:
    """Test security monitoring and alerting"""

    @patch('app.utils.rate_limiter.redis_service')
    async def test_critical_alert_logging(self, mock_redis):
        """Test critical security alerts are logged"""
        # Mock high-volume attack data
        mock_keys = ["rate_limit:ip:192.168.1.100:login"]
        mock_data = [json.dumps({"attempts": 150, "first_attempt": time.time()})]
        
        mock_redis.redis_client.keys.return_value = mock_keys
        mock_redis.redis_client.get.side_effect = mock_data
        
        with patch('app.utils.rate_limiter.logger') as mock_logger:
            analysis = await analyze_rate_limit_patterns()
            
            # Should log critical alert for high-volume attacks
            mock_logger.critical.assert_called()
            assert "SECURITY ALERT" in str(mock_logger.critical.call_args)

    @patch('app.utils.rate_limiter.redis_service')
    async def test_pattern_analysis_identifies_threats(self, mock_redis):
        """Test pattern analysis correctly identifies different threat types"""
        mock_keys = [
            "rate_limit:ip:192.168.1.100:login",
            "rate_limit:subnet:192.168.1.0/24:login", 
            "rate_limit:fingerprint:abc123def456:login"
        ]
        
        mock_data = [
            json.dumps({"attempts": 60}),   # Suspicious IP
            json.dumps({"attempts": 250}),  # High traffic subnet
            json.dumps({"attempts": 25})    # Blocked fingerprint
        ]
        
        mock_redis.redis_client.keys.return_value = mock_keys
        mock_redis.redis_client.get.side_effect = mock_data
        
        analysis = await analyze_rate_limit_patterns()
        
        assert len(analysis["suspicious_ips"]) == 1
        assert len(analysis["high_traffic_subnets"]) == 1
        assert len(analysis["blocked_fingerprints"]) == 1
        assert analysis["suspicious_ips"][0]["total_attempts"] == 60
