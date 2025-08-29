"""
Tests for execute_simple_deepseek_chat() choosing chat vs completion mode
based on chat context (chat_id, bot_id) and bot active status (DB).
"""

# Path bootstrap so 'app' package is importable when running directly
import sys
from pathlib import Path
_BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
if str(_BACKEND_DIR / "app") not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR / "app"))

import pytest
from types import SimpleNamespace

from app.models.nodes import NodeExecutionResult

# Prefer package-qualified import; fall back to direct path import to avoid any
# nodes/__init__.py side effects or circular imports during test collection.
try:
    import app.services.nodes.processors.simple_deepseek_chat as sdc
except Exception:
    PROC_DIR = _BACKEND_DIR / "app" / "services" / "nodes" / "processors"
    if str(PROC_DIR) not in sys.path:
        sys.path.insert(0, str(PROC_DIR))
    import simple_deepseek_chat as sdc


@pytest.mark.asyncio
async def test_chat_mode_when_bot_active(monkeypatch):
    """Should call execute_deepseek_chat_mode when mode=chat and is_bot_active=True."""
    # Arrange input coming from Telegram node
    context = {
        "inputs": {
            "message_data": {
                "session_id": "test-session",
                "chat_id": 110681733,
                "input_text": "Hello",
                "input_type": "text",
                "bot_id": "7624444620",
                "metadata": {"bot_id": "7624444620"}
            }
        },
        "settings": {
            "mode": "chat",
            "model": "deepseek-chat",
            "system_prompt": "you are a telegram assistant",
            "temperature": 0.1,
        }
    }

    called = SimpleNamespace(chat=False, completion=False)

    async def stub_chat_mode(**kwargs):  # signature via kwargs for flexibility
        called.chat = True
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "chat"}}, status="success")

    async def stub_completion_mode(**kwargs):
        called.completion = True
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "completion"}}, status="success")

    # Patch DB validator and downstream executors
    monkeypatch.setattr(sdc, "is_bot_active", lambda bot_id: True)
    monkeypatch.setattr(sdc, "execute_deepseek_chat_mode", lambda **kw: stub_chat_mode(**kw))
    monkeypatch.setattr(sdc, "execute_deepseek_completion_mode", lambda **kw: stub_completion_mode(**kw))

    # Act
    result = await sdc.execute_simple_deepseek_chat(context)

    # Assert
    assert result.status == "success"
    assert called.chat is True
    assert called.completion is False


@pytest.mark.asyncio
async def test_fallback_to_completion_when_bot_inactive(monkeypatch):
    """Should call completion when mode=chat but bot is not active in DB."""
    context = {
        "inputs": {
            "message_data": {
                "session_id": "test-session",
                "chat_id": 110681733,
                "input_text": "Hello",
                "input_type": "text",
                "bot_id": "7624444620",
                "metadata": {"bot_id": "7624444620"}
            }
        },
        "settings": {
            "mode": "chat",
            "model": "deepseek-chat",
            "system_prompt": "sys",
            "temperature": 0.1,
        }
    }

    called = SimpleNamespace(chat=False, completion=False)

    async def stub_chat_mode(**kwargs):  # should NOT be called in this test
        called.chat = True
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "chat"}}, status="success")

    async def stub_completion_mode(**kwargs):
        called.completion = True
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "completion"}}, status="success")

    monkeypatch.setattr(sdc, "is_bot_active", lambda bot_id: False)
    monkeypatch.setattr(sdc, "execute_deepseek_chat_mode", lambda **kw: stub_chat_mode(**kw))
    monkeypatch.setattr(sdc, "execute_deepseek_completion_mode", lambda **kw: stub_completion_mode(**kw))

    result = await sdc.execute_simple_deepseek_chat(context)

    assert result.status == "success"
    assert called.completion is True
    assert called.chat is False


@pytest.mark.asyncio
async def test_completion_when_mode_completion_even_if_active(monkeypatch):
    """If user selected completion, we must use completion even if bot is active."""
    context = {
        "inputs": {
            "message_data": {
                "session_id": "test-session",
                "chat_id": 110681733,
                "input_text": "Hello",
                "input_type": "text",
                "bot_id": "7624444620",
                "metadata": {"bot_id": "7624444620"}
            }
        },
        "settings": {
            "mode": "completion",
            "model": "deepseek-chat",
            "system_prompt": "sys",
            "temperature": 0.1,
        }
    }

    called = SimpleNamespace(chat=False, completion=False)

    async def stub_chat_mode(**kwargs):
        called.chat = True
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "chat"}}, status="success")

    async def stub_completion_mode(**kwargs):
        called.completion = True
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "completion"}}, status="success")

    monkeypatch.setattr(sdc, "is_bot_active", lambda bot_id: True)
    monkeypatch.setattr(sdc, "execute_deepseek_chat_mode", lambda **kw: stub_chat_mode(**kw))
    monkeypatch.setattr(sdc, "execute_deepseek_completion_mode", lambda **kw: stub_completion_mode(**kw))

    result = await sdc.execute_simple_deepseek_chat(context)

    assert result.status == "success"
    assert called.completion is True
    assert called.chat is False


@pytest.mark.asyncio
async def test_chat_when_mode_chat_if_active(monkeypatch):
    """If user selected completion, we must use completion even if bot is active."""
    context = {
        "inputs": {
            "message_data": {
                "session_id": "test-session",
                "chat_id": 110681733,
                "input_text": "Hello",
                "input_type": "text",
                "bot_id": "7624444620",
                "metadata": {"bot_id": "7624444620"}
            }
        },
        "settings": {
            "mode": "chat",
            "model": "deepseek-chat",
            "system_prompt": "sys",
            "temperature": 0.1,
        }
    }

    called = SimpleNamespace(chat=False, completion=False)

    async def stub_chat_mode(**kwargs):
        called.chat = True
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "chat"}}, status="success")

    async def stub_completion_mode(**kwargs):
        called.completion = True
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "chat"}}, status="success")

    monkeypatch.setattr(sdc, "is_bot_active", lambda bot_id: True)
    monkeypatch.setattr(sdc, "execute_deepseek_chat_mode", lambda **kw: stub_chat_mode(**kw))
    monkeypatch.setattr(sdc, "execute_deepseek_completion_mode", lambda **kw: stub_completion_mode(**kw))

    result = await sdc.execute_simple_deepseek_chat(context)

    assert result.status == "success"
    assert called.completion is False
    assert called.chat is True


@pytest.mark.asyncio
async def test_db_fallback_resolves_bot_id_when_missing(monkeypatch):
    """When bot_id is missing in inputs but flow_id/node_id are present,
    the processor should resolve bot_id from DB mapping and choose chat mode.
    """
    # Imports local to the test to avoid affecting other tests
    from sqlalchemy import create_engine, Column, Integer, String, Boolean
    from sqlalchemy.orm import declarative_base, sessionmaker

    # 1) Build in-memory DB with ORM model including default_flow_id/default_node_id
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    SessionLocal = sessionmaker(bind=engine, future=True)
    Base = declarative_base()

    class TelegramBotConfigORM(Base):  # minimal fields required by the processor query
        __tablename__ = "telegram_bot_configs"
        id = Column(Integer, primary_key=True)
        bot_id = Column(String)
        is_active = Column(Boolean)
        default_flow_id = Column(String)
        default_node_id = Column(String)

    Base.metadata.create_all(engine)

    # Insert a matching active config
    flow_id = "flow-xyz"
    node_id = "node-abc"
    resolved_bot_id = "9999999999"
    session = SessionLocal()
    session.add(TelegramBotConfigORM(
        bot_id=resolved_bot_id,
        is_active=True,
        default_flow_id=flow_id,
        default_node_id=node_id,
    ))
    session.commit()

    # 2) Patch the processor's SessionLocal and TelegramBotConfig to use our in-memory DB/model
    # Use the already-imported `sdc` from module scope to avoid package import issues
    monkeypatch.setattr(sdc, "SessionLocal", SessionLocal)
    monkeypatch.setattr(sdc, "TelegramBotConfig", TelegramBotConfigORM)

    # 3) Ensure bot validation passes once bot_id is resolved
    monkeypatch.setattr(sdc, "is_bot_active", lambda _bot_id: True)

    # 4) Stub downstream executors to observe path
    from types import SimpleNamespace
    from app.models.nodes import NodeExecutionResult

    called = SimpleNamespace(chat=False, completion=False)

    async def stub_chat_mode(**kwargs):
        called.chat = True
        # Verify bot_id was indeed resolved and passed through
        assert kwargs.get("bot_id") == resolved_bot_id
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "chat"}}, status="success")

    async def stub_completion_mode(**kwargs):
        called.completion = True
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "completion"}}, status="success")

    monkeypatch.setattr(sdc, "execute_deepseek_chat_mode", lambda **kw: stub_chat_mode(**kw))
    monkeypatch.setattr(sdc, "execute_deepseek_completion_mode", lambda **kw: stub_completion_mode(**kw))

    # 5) Build context without bot_id but with flow_id/node_id
    context = {
        "inputs": {
            "message_data": {
                "session_id": "sess-fallback",
                "chat_id": 110681733,
                "input_text": "Hi",
                "input_type": "text",
            }
        },
        "settings": {
            "mode": "chat",
            "model": "deepseek-chat",
            "system_prompt": "you are a telegram assistant",
            "temperature": 0.1,
        },
        "flow_id": flow_id,
        "node_id": node_id,
    }

    # 6) Execute and assert chat path selected due to DB fallback
    result = await sdc.execute_simple_deepseek_chat(context)

    assert result.status == "success"
    assert called.chat is True
    assert called.completion is False

    # Cleanup
    session.close()
    engine.dispose()