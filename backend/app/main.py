from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.database import engine, Base
from .api.v1.api import api_router
from .core.node_registry import node_registry
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables with error handling
try:
    logger.info(f"Attempting to connect to database: {settings.database_url}")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
except Exception as e:
    logger.error(f"Failed to create database tables: {e}")
    logger.error("Application will continue but database operations may fail")

# Initialize node registry (this will register all built-in nodes)
print(f"Initialized node registry with {len(node_registry.get_all_node_types())} node types")

app = FastAPI(
    title=settings.project_name,
    openapi_url=f"{settings.api_v1_str}/openapi.json"
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.api_v1_str)


@app.get("/")
def read_root():
    return {"message": "Social Media Flow API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
