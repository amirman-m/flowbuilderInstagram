from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database - Pydantic automatically uses DATABASE_URL env var if available
    database_url: str = "postgresql://postgres:postgres@db:5432/socialmediaflow"
    
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


settings = Settings()
