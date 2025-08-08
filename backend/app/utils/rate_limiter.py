
import time
import json
import hashlib
import ipaddress
from functools import wraps
from typing import Dict, Any, List, Callable, Optional
from fastapi import HTTPException, status, Request
from ..services.redis_service import redis_service
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

class MultiLayerRateLimiter:
    def __init__(self):
        self.redis = redis_service
    
    async def is_rate_limited(self, key: str, max_attempts: int, window_seconds: int) -> Dict[str, Any]:
        """Check if a key is rate limited"""
        try:
            # Get current attempt data
            current_data = await self.redis.redis_client.get(f"rate_limit:{key}")
            
            if not current_data:
                # First attempt
                attempt_data = {
                    "attempts": 1,
                    "first_attempt": time.time(),
                    "last_attempt": time.time()
                }
                await self.redis.redis_client.setex(
                    f"rate_limit:{key}", 
                    window_seconds, 
                    json.dumps(attempt_data)
                )
                return {"blocked": False, "attempts": 1, "remaining": max_attempts - 1}
            
            attempt_data = json.loads(current_data)
            current_time = time.time()
            
            # Check if window has expired
            if current_time - attempt_data["first_attempt"] > window_seconds:
                # Reset window
                new_data = {
                    "attempts": 1,
                    "first_attempt": current_time,
                    "last_attempt": current_time
                }
                await self.redis.redis_client.setex(
                    f"rate_limit:{key}", 
                    window_seconds, 
                    json.dumps(new_data)
                )
                return {"blocked": False, "attempts": 1, "remaining": max_attempts - 1}
            
            # Increment attempts
            attempt_data["attempts"] += 1
            attempt_data["last_attempt"] = current_time
            
            if attempt_data["attempts"] > max_attempts:
                # Rate limited
                remaining_time = window_seconds - (current_time - attempt_data["first_attempt"])
                await self.redis.redis_client.setex(
                    f"rate_limit:{key}", 
                    int(remaining_time), 
                    json.dumps(attempt_data)
                )
                return {
                    "blocked": True, 
                    "attempts": attempt_data["attempts"],
                    "remaining_time": int(remaining_time)
                }
            
            # Update attempt data
            remaining_window = window_seconds - (current_time - attempt_data["first_attempt"])
            await self.redis.redis_client.setex(
                f"rate_limit:{key}", 
                int(remaining_window), 
                json.dumps(attempt_data)
            )
            
            return {
                "blocked": False, 
                "attempts": attempt_data["attempts"],
                "remaining": max_attempts - attempt_data["attempts"]
            }
            
        except Exception as e:
            logger.error(f"Rate limiting check failed: {str(e)}")
            # Fail open - don't block on Redis errors
            return {"blocked": False, "attempts": 1, "remaining": max_attempts - 1}

    async def check_multiple_limits(self, request: Request, limits: List[dict]) -> Dict[str, Any]:
        """
        Check multiple rate limit strategies simultaneously
        Returns the most restrictive limit that's been exceeded
        """
        blocked_limits = []
        
        for limit_config in limits:
            try:
                key = limit_config["key_func"](request)
                max_attempts = limit_config["max_attempts"]
                window_seconds = limit_config["window_seconds"]
                limit_name = limit_config["name"]
                
                rate_status = await self.is_rate_limited(
                    key, max_attempts, window_seconds
                )
                
                if rate_status["blocked"]:
                    logger.warning(
                        f"Rate limit '{limit_name}' exceeded for key {key}: "
                        f"{rate_status['attempts']} attempts, "
                        f"{rate_status['remaining_time']}s remaining"
                    )
                    blocked_limits.append({
                        "limit_name": limit_name,
                        "key": key,
                        "remaining_time": rate_status["remaining_time"],
                        "attempts": rate_status["attempts"],
                        "max_attempts": max_attempts
                    })
            except Exception as e:
                logger.error(f"Error checking rate limit '{limit_config.get('name', 'unknown')}': {str(e)}")
                continue
        
        if blocked_limits:
            # Return the limit with the longest remaining time (most restrictive)
            most_restrictive = max(blocked_limits, key=lambda x: x["remaining_time"])
            return {
                "blocked": True,
                **most_restrictive
            }
        
        return {"blocked": False}

    async def clear_rate_limit(self, key: str) -> bool:
        """Clear rate limit for a key (useful after successful authentication)"""
        try:
            result = await self.redis.redis_client.delete(f"rate_limit:{key}")
            return result > 0
        except Exception as e:
            logger.error(f"Failed to clear rate limit for {key}: {str(e)}")
            return False

    async def clear_multiple_rate_limits(self, request: Request, limit_configs: List[dict]) -> int:
        """Clear multiple rate limits (useful after successful operations)"""
        cleared_count = 0
        for config in limit_configs:
            try:
                key = config["key_func"](request)
                if await self.clear_rate_limit(key):
                    cleared_count += 1
                    logger.info(f"Cleared rate limit for {config['name']}: {key}")
            except Exception as e:
                logger.error(f"Failed to clear rate limit for {config.get('name', 'unknown')}: {str(e)}")
        return cleared_count

# Enhanced key generation functions
def ip_key(request: Request) -> str:
    """Generate rate limit key based on IP only"""
    client_ip = request.client.host
    return f"ip:{client_ip}"

def subnet_key(request: Request, subnet_mask: int = 24) -> str:
    """Generate rate limit key based on IP subnet"""
    client_ip = request.client.host
    
    try:
        ip = ipaddress.ip_address(client_ip)
        if ip.version == 4:
            network = ipaddress.ip_network(f"{client_ip}/{subnet_mask}", strict=False)
            return f"subnet:{network.network_address}/{subnet_mask}"
        else:
            # For IPv6, use /64 subnet
            network = ipaddress.ip_network(f"{client_ip}/64", strict=False)
            return f"subnet:{network.network_address}/64"
    except Exception as e:
        logger.warning(f"Failed to calculate subnet for IP {client_ip}: {str(e)}")
        # Fallback to full IP
        return f"ip:{client_ip}"

def user_agent_fingerprint_key(request: Request) -> str:
    """Generate rate limit key based on browser fingerprint"""
    user_agent = request.headers.get("user-agent", "unknown")
    accept = request.headers.get("accept", "")
    accept_language = request.headers.get("accept-language", "")
    
    # Create fingerprint from multiple headers
    fingerprint_string = f"{user_agent}:{accept}:{accept_language}"
    fingerprint = hashlib.sha256(fingerprint_string.encode()).hexdigest()[:16]
    return f"fingerprint:{fingerprint}"

def endpoint_key(request: Request) -> str:
    """Generate rate limit key based on IP + endpoint"""
    client_ip = request.client.host
    endpoint = f"{request.method}:{request.url.path}"
    return f"ip:{client_ip}:endpoint:{endpoint}"

def daily_ip_key(request: Request) -> str:
    """Generate daily rate limit key based on IP"""
    client_ip = request.client.host
    date_str = time.strftime("%Y-%m-%d")
    return f"daily:{date_str}:ip:{client_ip}"

def email_key(email: str) -> str:
    """Generate rate limit key based on email (call this manually in endpoints)"""
    email_hash = hashlib.sha256(email.lower().encode()).hexdigest()[:16]
    return f"email:{email_hash}"

# Rate limiting configurations
RATE_LIMIT_CONFIGS = {
    "production": {
        "registration": [
            {"name": "reg_per_ip", "key_func": ip_key, "max_attempts": 2, "window_seconds": 600},  # 2 per 10min
            {"name": "reg_per_subnet", "key_func": lambda r: subnet_key(r, 24), "max_attempts": 8, "window_seconds": 600},  # 8 per subnet per 10min
            {"name": "reg_per_fingerprint", "key_func": user_agent_fingerprint_key, "max_attempts": 3, "window_seconds": 600},  # 3 per browser per 10min
            {"name": "reg_daily_ip", "key_func": daily_ip_key, "max_attempts": 5, "window_seconds": 86400},  # 5 per day per IP
        ],
        "login": [
            {"name": "login_per_ip", "key_func": ip_key, "max_attempts": 5, "window_seconds": 300},  # 5 per 5min
            {"name": "login_per_subnet", "key_func": lambda r: subnet_key(r, 24), "max_attempts": 50, "window_seconds": 300},  # 50 per subnet per 5min
            {"name": "login_daily_ip", "key_func": daily_ip_key, "max_attempts": 100, "window_seconds": 86400},  # 100 per day per IP
        ],
        "refresh": [
            {"name": "refresh_per_ip", "key_func": ip_key, "max_attempts": 10, "window_seconds": 300},  # 10 per 5min
            {"name": "refresh_per_subnet", "key_func": lambda r: subnet_key(r, 24), "max_attempts": 100, "window_seconds": 300},  # 100 per subnet per 5min
        ]
    },
    "staging": {
        "registration": [
            {"name": "reg_per_ip", "key_func": ip_key, "max_attempts": 3, "window_seconds": 300},
            {"name": "reg_per_subnet", "key_func": lambda r: subnet_key(r, 24), "max_attempts": 15, "window_seconds": 300},
            {"name": "reg_per_fingerprint", "key_func": user_agent_fingerprint_key, "max_attempts": 5, "window_seconds": 300},
            {"name": "reg_daily_ip", "key_func": daily_ip_key, "max_attempts": 10, "window_seconds": 86400},
        ],
        "login": [
            {"name": "login_per_ip", "key_func": ip_key, "max_attempts": 8, "window_seconds": 300},
            {"name": "login_per_subnet", "key_func": lambda r: subnet_key(r, 24), "max_attempts": 80, "window_seconds": 300},
            {"name": "login_daily_ip", "key_func": daily_ip_key, "max_attempts": 200, "window_seconds": 86400},
        ],
        "refresh": [
            {"name": "refresh_per_ip", "key_func": ip_key, "max_attempts": 15, "window_seconds": 300},
            {"name": "refresh_per_subnet", "key_func": lambda r: subnet_key(r, 24), "max_attempts": 150, "window_seconds": 300},
        ]
    },
    "development": {
        "registration": [
            {"name": "reg_per_ip", "key_func": ip_key, "max_attempts": 10, "window_seconds": 300},
            {"name": "reg_per_subnet", "key_func": lambda r: subnet_key(r, 24), "max_attempts": 50, "window_seconds": 300},
        ],
        "login": [
            {"name": "login_per_ip", "key_func": ip_key, "max_attempts": 20, "window_seconds": 300},
            {"name": "login_per_subnet", "key_func": lambda r: subnet_key(r, 24), "max_attempts": 200, "window_seconds": 300},
        ],
        "refresh": [
            {"name": "refresh_per_ip", "key_func": ip_key, "max_attempts": 50, "window_seconds": 300},
        ]
    }
}

# Global rate limiter instance
multi_rate_limiter = MultiLayerRateLimiter()

def multi_layer_rate_limit(limit_type: str, clear_on_success: bool = False):
    """
    Apply multi-layer rate limiting based on environment and limit type
    
    Args:
        limit_type: Type of rate limit ('registration', 'login', 'refresh')
        clear_on_success: Whether to clear rate limits on successful operation
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find request object
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                request = kwargs.get('request')
            
            if not request:
                logger.warning(f"Multi-layer rate limiter ({limit_type}): No request object found")
                return await func(*args, **kwargs)
            
            # Get environment-specific configuration
            environment = getattr(settings, 'environment', 'production')
            limit_configs = RATE_LIMIT_CONFIGS.get(environment, RATE_LIMIT_CONFIGS['production'])
            
            if limit_type not in limit_configs:
                logger.error(f"Unknown rate limit type: {limit_type}")
                return await func(*args, **kwargs)
            
            # Check all rate limits for this type
            limit_result = await multi_rate_limiter.check_multiple_limits(
                request, limit_configs[limit_type]
            )
            
            if limit_result["blocked"]:
                error_detail = {
                    "message": f"Rate limit exceeded: {limit_result['limit_name']}",
                    "limit_type": limit_result['limit_name'],
                    "remaining_time": limit_result["remaining_time"],
                    "attempts": limit_result["attempts"],
                    "max_attempts": limit_result["max_attempts"]
                }
                
                logger.warning(
                    f"Rate limit blocked request: {limit_result['limit_name']} "
                    f"for key {limit_result.get('key', 'unknown')}"
                )
                
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=error_detail
                )
            
            try:
                # Execute the original function
                result = await func(*args, **kwargs)
                
                # Clear rate limits on successful operation if requested
                if clear_on_success:
                    cleared_count = await multi_rate_limiter.clear_multiple_rate_limits(
                        request, limit_configs[limit_type]
                    )
                    if cleared_count > 0:
                        logger.info(f"Cleared {cleared_count} rate limits after successful {limit_type}")
                
                return result
                
            except HTTPException as e:
                # Don't clear rate limits on authentication/validation failures
                if e.status_code in [400, 401, 403, 422]:
                    logger.info(f"Rate limit NOT cleared due to {limit_type} failure: {e.status_code}")
                raise
                
        return wrapper
    return decorator

# Helper function for email-based rate limiting within endpoints
async def check_email_rate_limit(email: str, max_attempts: int, window_seconds: int) -> None:
    """
    Check email-based rate limit - call this inside endpoints
    
    Args:
        email: Email address to check
        max_attempts: Maximum attempts allowed
        window_seconds: Time window in seconds
        
    Raises:
        HTTPException: If rate limit is exceeded
    """
    try:
        email_rate_key = email_key(email)
        rate_status = await multi_rate_limiter.is_rate_limited(
            email_rate_key, max_attempts, window_seconds
        )
        
        if rate_status["blocked"]:
            logger.warning(f"Email rate limit exceeded for {email_rate_key}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": "Too many attempts for this email address",
                    "remaining_time": rate_status["remaining_time"],
                    "max_attempts": max_attempts
                }
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email rate limit check failed for {email}: {str(e)}")
        # Fail open - don't block on errors

# Monitoring and alerting function
async def analyze_rate_limit_patterns() -> Dict[str, Any]:
    """
    Analyze rate limiting patterns for security monitoring
    Returns suspicious activity report
    """
    try:
        # Get all rate limit keys
        keys = await redis_service.redis_client.keys("rate_limit:*")
        
        analysis = {
            "total_active_limits": len(keys),
            "suspicious_ips": [],
            "high_traffic_subnets": [],
            "blocked_fingerprints": [],
            "timestamp": time.time()
        }
        
        ip_attempts = {}
        subnet_attempts = {}
        fingerprint_attempts = {}
        
        for key in keys:
            try:
                data = await redis_service.redis_client.get(key)
                if not data:
                    continue
                    
                attempts_data = json.loads(data)
                attempts = attempts_data.get("attempts", 0)
                
                if ":ip:" in key and attempts > 10:
                    ip = key.split(":ip:")[1].split(":")[0]
                    ip_attempts[ip] = ip_attempts.get(ip, 0) + attempts
                
                elif ":subnet:" in key and attempts > 50:
                    subnet = key.split(":subnet:")[1].split(":")[0]
                    subnet_attempts[subnet] = subnet_attempts.get(subnet, 0) + attempts
                
                elif ":fingerprint:" in key and attempts > 5:
                    fingerprint = key.split(":fingerprint:")[1].split(":")[0]
                    fingerprint_attempts[fingerprint] = fingerprint_attempts.get(fingerprint, 0) + attempts
                    
            except Exception as e:
                logger.warning(f"Error analyzing key {key}: {str(e)}")
                continue
        
        # Identify suspicious patterns
        analysis["suspicious_ips"] = [
            {"ip": ip, "total_attempts": attempts} 
            for ip, attempts in ip_attempts.items() 
            if attempts > 50
        ]
        
        analysis["high_traffic_subnets"] = [
            {"subnet": subnet, "total_attempts": attempts} 
            for subnet, attempts in subnet_attempts.items() 
            if attempts > 200
        ]
        
        analysis["blocked_fingerprints"] = [
            {"fingerprint": fp[:8] + "...", "total_attempts": attempts} 
            for fp, attempts in fingerprint_attempts.items() 
            if attempts > 20
        ]
        
        # Log critical alerts
        for suspicious_ip in analysis["suspicious_ips"]:
            if suspicious_ip["total_attempts"] > 100:
                logger.critical(
                    f"SECURITY ALERT: IP {suspicious_ip['ip']} has "
                    f"{suspicious_ip['total_attempts']} rate-limited attempts"
                )
        
        return analysis
        
    except Exception as e:
        logger.error(f"Rate limit pattern analysis failed: {str(e)}")
        return {"error": str(e), "timestamp": time.time()}