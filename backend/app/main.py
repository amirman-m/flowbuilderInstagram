from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.database import engine, Base
from .api.v1.api import api_router
from .core.node_registry import node_registry
import logging
from .services.scheduler_service import start_scheduler, shutdown_scheduler

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
all_nodes = node_registry.get_all_node_types()
print(f"Initialized node registry with {len(all_nodes)} node types")
print("Registered node types:")
for node in all_nodes:
    print(f"  - {node.id} ({node.category.value}): {node.name}")

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


@app.on_event("startup")
async def on_startup():
    # Start global scheduler for scheduled flows
    try:
        start_scheduler()
        logger.info("Scheduler started on app startup")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    # Gracefully shutdown scheduler
    try:
        shutdown_scheduler(wait=False)
        logger.info("Scheduler shut down on app shutdown")
    except Exception as e:
        logger.error(f"Failed to shutdown scheduler: {e}")
