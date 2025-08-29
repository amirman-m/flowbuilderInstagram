"""
Integration-style test: verify chat mode is selected when DB has an active bot
for the given bot_id. We spin up an in-memory SQLite, create minimal schema,
insert a row, and monkeypatch BotValidationService._get_db_session.
"""

# Path bootstrap for 'app' imports
import sys
from pathlib import Path
_BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
if str(_BACKEND_DIR / "app") not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR / "app"))

import pytest
from types import SimpleNamespace

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.nodes import NodeExecutionResult
try:
    import app.services.nodes.processors.simple_deepseek_chat as sdc
except Exception:
    # Fallback: import module directly from processors directory to avoid
    # any app.services.nodes.processors.__init__ side effects during collection
    PROC_DIR = _BACKEND_DIR / "app" / "services" / "nodes" / "processors"
    if str(PROC_DIR) not in sys.path:
        sys.path.insert(0, str(PROC_DIR))
    import simple_deepseek_chat as sdc
from app.services.bot_validation import BotValidationService


@pytest.mark.asyncio
async def test_chat_mode_with_real_db_session(monkeypatch):
    # 1) Setup in-memory DB and schema row
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    SessionLocal = sessionmaker(bind=engine, future=True)
    session = SessionLocal()

    # Create minimal table used by BotValidationService
    session.execute(text(
        """
        CREATE TABLE telegram_bot_configs (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            bot_username TEXT,
            bot_id TEXT,
            is_active BOOLEAN,
            created_at TEXT,
            webhook_url TEXT
        );
        """
    ))
    bot_id = "7624444620"
    session.execute(text(
        """
        INSERT INTO telegram_bot_configs (id, user_id, bot_username, bot_id, is_active, created_at, webhook_url)
        VALUES (1, 1, 'AIMigration_bot', :bot_id, 1, '2025-08-25T06:42:19.33Z', 'https://example/webhook');
        """
    ), {"bot_id": bot_id})
    session.commit()

    # 2) Monkeypatch DB getter in BotValidationService
    def _get_db_session_override():
        return session
    monkeypatch.setattr(BotValidationService, "_get_db_session", staticmethod(_get_db_session_override))

    # 3) Stub downstream API calls to avoid network
    called = SimpleNamespace(chat=False, completion=False)

    async def stub_chat_mode(**kwargs):
        called.chat = True
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "chat"}}, status="success")

    async def stub_completion_mode(**kwargs):
        called.completion = True
        return NodeExecutionResult(outputs={"ai_response": {"ai_response": "ok", "mode": "completion"}}, status="success")

    monkeypatch.setattr(sdc, "execute_deepseek_chat_mode", lambda **kw: stub_chat_mode(**kw))
    monkeypatch.setattr(sdc, "execute_deepseek_completion_mode", lambda **kw: stub_completion_mode(**kw))

    # 4) Build context mimicking Telegram input
    context = {
        "inputs": {
            "message_data": {
                "session_id": "sess-1",
                "chat_id": 110681733,
                "input_text": "سلام",
                "input_type": "text",
                "bot_id": bot_id,
                "metadata": {"bot_id": bot_id}
            }
        },
        "settings": {
            "mode": "chat",
            "model": "deepseek-chat",
            "system_prompt": "you are a telegram assistant",
            "temperature": 0.1,
        }
    }

    # 5) Execute and assert chat path selected
    result = await sdc.execute_simple_deepseek_chat(context)

    assert result.status == "success"
    assert called.chat is True
    assert called.completion is False

    # Cleanup
    session.close()
    engine.dispose()
