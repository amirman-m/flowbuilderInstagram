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
    
    # API
    api_v1_str: str = "/api/v1"
    project_name: str = "Social Media Flow"
    
    # CORS
    backend_cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # Simple Auth (no JWT for now)
    secret_key: str = "simple-secret-key-change-in-production"
    
    # Environment
    environment: str = "development"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
