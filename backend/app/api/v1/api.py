from fastapi import APIRouter
from .auth import router as auth_router
from .flows import router as flows_router
from .nodes import router as nodes_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(flows_router, prefix="/flows", tags=["flows"])
api_router.include_router(nodes_router, prefix="/nodes", tags=["nodes"])
