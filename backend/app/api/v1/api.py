from fastapi import APIRouter
from .auth import router as auth_router
from .flows import router as flows_router
from .nodes import router as nodes_router
from .telegram import router as telegram_router
from .telegram_bot import router as telegram_bot_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(flows_router, prefix="/flows", tags=["flows"])
api_router.include_router(nodes_router, prefix="/nodes", tags=["nodes"])
api_router.include_router(telegram_router, prefix="/telegram", tags=["telegram"])
api_router.include_router(telegram_bot_router, prefix="/telegram-bot", tags=["telegram-bot"])
