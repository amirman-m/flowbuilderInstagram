"""
Test for Telegram webhook message processing with bot_id parameter
"""
# Test path bootstrap: ensure 'backend' and 'backend/app' are importable
import sys
from pathlib import Path
_BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))         # adds '.../backend'
if str(_BACKEND_DIR / "app") not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR / "app")) # adds '.../backend/app'

import pytest
from datetime import datetime, timezone
from app.services.nodes.triggers.telegram_input import process_webhook_message


@pytest.mark.asyncio
async def test_process_webhook_message_includes_bot_id():
    """Test that process_webhook_message includes bot_id in message_data when provided"""
    
    # Test data with your actual bot_id
    bot_id = "7624444620"
    access_token = "test_token"
    flow_id = 1
    
    # Sample Telegram webhook data (text message)
    webhook_data = {
        "update_id": 123456789,
        "message": {
            "message_id": 360,
            "from": {
                "id": 110681733,
                "is_bot": False,
                "first_name": "Test",
                "username": "Amirman_9592",
                "language_code": "en"
            },
            "chat": {
                "id": 110681733,
                "first_name": "Test",
                "username": "Amirman_9592",
                "type": "private"
            },
            "date": 1724932477,
            "text": "حالا راجع سیب بگو"
        }
    }
    
    # Call the function with bot_id
    result = await process_webhook_message(
        webhook_data=webhook_data,
        access_token=access_token,
        flow_id=flow_id,
        bot_id=bot_id
    )
    
    # Verify the result is successful
    assert result.status == "success"
    assert "message_data" in result.outputs
    
    message_data = result.outputs["message_data"]
    
    # Test 1: Verify bot_id is in root level of message_data
    assert "bot_id" in message_data
    assert message_data["bot_id"] == bot_id
    
    # Test 2: Verify telegram_bot_id is also in root level (for compatibility)
    assert "telegram_bot_id" in message_data
    assert message_data["telegram_bot_id"] == bot_id
    
    # Test 3: Verify bot_id is in metadata
    assert "metadata" in message_data
    metadata = message_data["metadata"]
    assert "bot_id" in metadata
    assert metadata["bot_id"] == bot_id
    
    # Test 4: Verify telegram_bot_id is also in metadata
    assert "telegram_bot_id" in metadata
    assert metadata["telegram_bot_id"] == bot_id
    
    # Test 5: Verify other expected fields are still present
    assert message_data["chat_id"] == 110681733
    assert message_data["input_text"] == "حالا راجع سیب بگو"
    assert message_data["input_type"] == "text"
    assert metadata["from_user"] == "Amirman_9592"
    assert metadata["chat_type"] == "private"
    
    print(f"✅ Test passed! bot_id {bot_id} correctly included in message_data")
    print(f"Root level bot_id: {message_data.get('bot_id')}")
    print(f"Metadata bot_id: {metadata.get('bot_id')}")


@pytest.mark.asyncio
async def test_process_webhook_message_without_bot_id():
    """Test that process_webhook_message works without bot_id (backward compatibility)"""
    
    access_token = "test_token"
    flow_id = 1
    
    # Sample Telegram webhook data (text message)
    webhook_data = {
        "update_id": 123456789,
        "message": {
            "message_id": 360,
            "from": {
                "id": 110681733,
                "is_bot": False,
                "first_name": "Test",
                "username": "Amirman_9592",
                "language_code": "en"
            },
            "chat": {
                "id": 110681733,
                "first_name": "Test",
                "username": "Amirman_9592",
                "type": "private"
            },
            "date": 1724932477,
            "text": "test message"
        }
    }
    
    # Call the function without bot_id
    result = await process_webhook_message(
        webhook_data=webhook_data,
        access_token=access_token,
        flow_id=flow_id
        # bot_id=None (default)
    )
    
    # Verify the result is successful
    assert result.status == "success"
    assert "message_data" in result.outputs
    
    message_data = result.outputs["message_data"]
    
    # Test: Verify bot_id fields are NOT present when not provided
    assert "bot_id" not in message_data
    assert "telegram_bot_id" not in message_data
    
    metadata = message_data["metadata"]
    assert "bot_id" not in metadata
    assert "telegram_bot_id" not in metadata
    
    # Test: Verify other fields are still present
    assert message_data["chat_id"] == 110681733
    assert message_data["input_text"] == "test message"
    assert message_data["input_type"] == "text"
    
    print("✅ Backward compatibility test passed! No bot_id fields when not provided")


@pytest.mark.asyncio
async def test_process_webhook_message_voice_with_bot_id():
    """Test that bot_id is included in voice message processing"""
    
    bot_id = "7624444620"
    access_token = "test_token"
    flow_id = 1
    
    # Sample Telegram webhook data (voice message)
    webhook_data = {
        "update_id": 123456789,
        "message": {
            "message_id": 361,
            "from": {
                "id": 110681733,
                "is_bot": False,
                "first_name": "Test",
                "username": "Amirman_9592"
            },
            "chat": {
                "id": 110681733,
                "first_name": "Test",
                "username": "Amirman_9592",
                "type": "private"
            },
            "date": 1724932500,
            "voice": {
                "duration": 5,
                "mime_type": "audio/ogg",
                "file_id": "test_voice_file_id",
                "file_unique_id": "test_unique_id",
                "file_size": 12345
            }
        }
    }
    
    # Call the function with bot_id
    result = await process_webhook_message(
        webhook_data=webhook_data,
        access_token=access_token,
        flow_id=flow_id,
        bot_id=bot_id
    )
    
    # Verify the result is successful
    assert result.status == "success"
    assert "message_data" in result.outputs
    
    message_data = result.outputs["message_data"]
    
    # Test: Verify bot_id is included in voice message
    assert message_data["bot_id"] == bot_id
    assert message_data["telegram_bot_id"] == bot_id
    assert message_data["metadata"]["bot_id"] == bot_id
    assert message_data["metadata"]["telegram_bot_id"] == bot_id
    
    # Test: Verify voice-specific fields
    assert message_data["input_type"] == "voice"
    assert "voice_input" in message_data
    assert message_data["voice_input"]["file_id"] == "test_voice_file_id"
    
    print("✅ Voice message test passed! bot_id correctly included")


if __name__ == "__main__":
    import asyncio
    
    async def run_tests():
        print("🧪 Running Telegram webhook bot_id tests...")
        print("=" * 50)
        
        try:
            await test_process_webhook_message_includes_bot_id()
            await test_process_webhook_message_without_bot_id()
            await test_process_webhook_message_voice_with_bot_id()
            
            print("=" * 50)
            print("🎉 All tests passed!")
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
            raise
    
    asyncio.run(run_tests())
