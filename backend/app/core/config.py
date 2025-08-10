from pydantic_settings import BaseSettings
from typing import Optional, List
import os


class Settings(BaseSettings):
    # Database
    database_url: str
    
    # Redis
    redis_url: str
    
    # Keycloak
    keycloak_url: str
    keycloak_realm: str
    keycloak_client_id: str
    keycloak_client_secret: str
    keycloak_admin_username: str
    keycloak_admin_password: str
    
    # API
    api_v1_str: str = "/api/v1"
    project_name: str = "Social Media Flow"
    
    # CORS
    backend_cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # Frontend URL for OAuth callbacks
    frontend_url: str = "http://localhost:3000"
    
    # Simple Auth (no JWT for now)
    secret_key: str 
    
    # Environment
    environment: str = "production"
    
    # Cookie Settings for Authentication
    cookie_secure: bool = True  # Set to True in production with HTTPS
    cookie_samesite: str = "lax"  # "strict" for maximum security, "lax" for better UX
    access_token_expire_minutes: int = 5  # 5 minutes (short-lived for security)
    refresh_token_expire_minutes: int = 30  # 30 minutes (token rotation enabled)
    
    class Config:
        # Load from .env.prod if it exists and ENVIRONMENT is production, otherwise load from .env
        env_file = ".env.prod" if os.path.exists(".env.prod") and os.getenv("ENVIRONMENT", "").lower() == "production" else ".env"
        case_sensitive = False


settings = Settings()
