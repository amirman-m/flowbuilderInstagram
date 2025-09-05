from typing import Dict, Any, List
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
from app.services.utils.input_type import determine_input_type
from app.services.utils.chat_context import extract_chat_context, should_use_chat_mode
from app.services.chat_history import ChatHistoryService, ChatMessage
from app.services.bot_validation import is_bot_active
import os
import uuid
import logging

logger = logging.getLogger(__name__)

try:
    from app.core.database import SessionLocal  # type: ignore
    from app.models.telegram_bot import TelegramBotConfig  # type: ignore
except Exception:
    SessionLocal = None
    TelegramBotConfig = None

def get_gemini_chat_node_type() -> NodeType:
    return NodeType(
        id="gemini-chat",
        name="Google Gemini Chat",
        description="Processes input text using Google Gemini's chat model",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="chat",
        color="#4285F4",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Contains session ID, input text, and input type",
                    data_type=[NodeDataType.STRING],
                    required=True
                )
            ],
            outputs=[
                NodePort(
                    id="ai_response",
                    name="ai_response",
                    label="AI Response",
                    description="The response from Google Gemini",
                    data_type=NodeDataType.STRING,
                    required=True
                )
            ]
        ),
        settings_schema={
            "type": "object",
            "properties": {
                "model": {
                    "type": "string",
                    "description": "Google Gemini model to use",
                    "default": "gemini-2.5-flash",
                    "enum": [
                        "gemini-2.5-pro",
                        "gemini-2.5-flash", 
                        "gemini-2.5-flash-lite",
                        "gemini-2.0-flash",
                        "gemini-2.0-flash-lite"
                    ]
                },
                "system_prompt": {
                    "type": "string",
                    "description": "System prompt to guide the AI response. Define the AI's role, personality, and behavior in detail.",
                    "default": "You are a helpful assistant.",
                    "minLength": 1,
                    "maxLength": 2000
                },
                "mode": {
                    "type": "string",
                    "description": "completion: single message → one reply; chat: remembers conversation.",
                    "default": "completion",
                    "enum": ["completion", "chat"]
                },               
                "history_limit": {
                    "type": "integer",
                    "description": "Maximum number of past messages to keep for chat history (used in chat mode)",
                    "minimum": 1,
                    "maximum": 35,
                    "default": 20
                },
                "temperature": {
                    "type": "number",
                    "description": "Controls randomness (0-2). Lower is more deterministic, higher is more creative.",
                    "minimum": 0,
                    "maximum": 2,
                    "default": 0.7
                },
                "max_tokens": {
                    "type": "integer",
                    "description": "Maximum number of tokens to generate (1-8192)",
                    "minimum": 1,
                    "maximum": 8192,
                    "default": 1024
                }
            },
            "required": ["model", "system_prompt"]
        }
    )

async def execute_gemini_completion_mode(
    input_text: str,
    system_prompt: str,
    model: str,
    temperature: float,
    max_tokens: int,
    session_id: str,
    input_source: str,
    input_type: str,
    chat_id: str = None,
    bot_id: str = None
) -> NodeExecutionResult:
    """
    Execute Google Gemini in completion mode (single-turn)
    """
    try:
        # Get API key from environment
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set or empty")
        
        logger.info(f"Gemini completion mode: model={model}, input_length={len(input_text)}")
        
        # Import Google Gemini client
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            raise ValueError("google-genai package not installed. Run: pip install google-genai")
        
        # Initialize Gemini client
        client = genai.Client(api_key=api_key)
        
        # Prepare the prompt with system message and user input
        full_prompt = f"{system_prompt}\n\nUser: {input_text}"
        
        # Configure generation settings
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            thinking_config=types.ThinkingConfig(thinking_budget=0)  # Disable thinking
        )
        
        # Call the Gemini API
        response = client.models.generate_content(
            model=model,
            contents=full_prompt,
            config=config
        )
        
        ai_response = response.text
        
        # Extract usage information if available
        input_tokens = getattr(response, 'prompt_token_count', 'N/A')
        output_tokens = getattr(response, 'candidates_token_count', 'N/A') if hasattr(response, 'candidates_token_count') else 'N/A'
        total_tokens = (input_tokens + output_tokens) if isinstance(input_tokens, int) and isinstance(output_tokens, int) else 'N/A'
        
        logger.info(f"Gemini completion successful: {len(ai_response)} chars, {total_tokens} tokens")
        
        # Create output structure
        timestamp = datetime.now(timezone.utc).isoformat()
        
        output_data = {
            "session_id": session_id,
            "input_text": input_text,
            "input_type": input_type,
            "ai_response": ai_response,
            "timestamp": timestamp,
            **({"chat_id": chat_id} if chat_id else {}),
            **({"bot_id": bot_id} if bot_id else {}),
            "metadata": {
                "mode": "completion",
                "model": model,
                "system_prompt": system_prompt,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "input_source": input_source
            }
        }
        
        return NodeExecutionResult(
            outputs={"ai_response": output_data},
            status="success",
            logs=[
                f"Gemini completion: {ai_response[:50]}{'...' if len(ai_response) > 50 else ''}",
                f"Tokens - Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}"
            ]
        )
        
    except Exception as e:
        logger.error(f"Gemini completion error: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Gemini completion error: {str(e)}"
        )

async def execute_gemini_chat_mode(
    input_text: str,
    system_prompt: str,
    model: str,
    temperature: float,
    max_tokens: int,
    session_id: str,
    input_source: str,
    input_type: str,
    history_limit: int,
    chat_id: str = None,
    bot_id: str = None
) -> NodeExecutionResult:
    """
    Execute Google Gemini in chat mode (multi-turn with history)
    """
    try:
        # Get API key from environment
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set or empty")
        
        logger.info(f"Gemini chat mode: model={model}, session={session_id}, history_limit={history_limit}")
        
        # Import Google Gemini client
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            raise ValueError("google-genai package not installed. Run: pip install google-genai")
        
        # Initialize Gemini client
        client = genai.Client(api_key=api_key)
        
        # Get chat history
        chat_service = ChatHistoryService()
        chat_history = chat_service.get_chat_history(session_id, limit=history_limit)
        
        # Build conversation context
        conversation_parts = [f"System: {system_prompt}"]
        
        # Add chat history
        for msg in chat_history:
            if msg.role == "user":
                conversation_parts.append(f"User: {msg.content}")
            elif msg.role == "assistant":
                conversation_parts.append(f"Assistant: {msg.content}")
        
        # Add current user message
        conversation_parts.append(f"User: {input_text}")
        conversation_parts.append("Assistant:")
        
        full_prompt = "\n".join(conversation_parts)
        
        # Configure generation settings
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            thinking_config=types.ThinkingConfig(thinking_budget=0)  # Disable thinking
        )
        
        # Call the Gemini API
        response = client.models.generate_content(
            model=model,
            contents=full_prompt,
            config=config
        )
        
        ai_response = response.text
        
        # Save messages to chat history
        chat_service.add_message(session_id, ChatMessage(
            role="user",
            content=input_text,
            timestamp=datetime.now(timezone.utc)
        ))
        
        chat_service.add_message(session_id, ChatMessage(
            role="assistant", 
            content=ai_response,
            timestamp=datetime.now(timezone.utc)
        ))
        
        # Extract usage information if available
        input_tokens = getattr(response, 'prompt_token_count', 'N/A')
        output_tokens = getattr(response, 'candidates_token_count', 'N/A') if hasattr(response, 'candidates_token_count') else 'N/A'
        total_tokens = (input_tokens + output_tokens) if isinstance(input_tokens, int) and isinstance(output_tokens, int) else 'N/A'
        
        logger.info(f"Gemini chat successful: {len(ai_response)} chars, {total_tokens} tokens, history: {len(chat_history)} msgs")
        
        # Create output structure
        timestamp = datetime.now(timezone.utc).isoformat()
        
        output_data = {
            "session_id": session_id,
            "input_text": input_text,
            "input_type": input_type,
            "ai_response": ai_response,
            "timestamp": timestamp,
            **({"chat_id": chat_id} if chat_id else {}),
            **({"bot_id": bot_id} if bot_id else {}),
            "metadata": {
                "mode": "chat",
                "model": model,
                "system_prompt": system_prompt,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "history_limit": history_limit,
                "history_count": len(chat_history),
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "input_source": input_source
            }
        }
        
        return NodeExecutionResult(
            outputs={"ai_response": output_data},
            status="success",
            logs=[
                f"Gemini chat: {ai_response[:50]}{'...' if len(ai_response) > 50 else ''}",
                f"History: {len(chat_history)} messages, Tokens: {total_tokens}"
            ]
        )
        
    except Exception as e:
        logger.error(f"Gemini chat error: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Gemini chat error: {str(e)}"
        )

async def execute_gemini_chat_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Main execution function for Google Gemini Chat node
    """
    try:
        # Extract inputs and settings
        inputs = context.get("inputs", {})
        settings = context.get("settings", {})
        node_id = context.get("node_id", "unknown")
        
        logger.info(f"Gemini chat node {node_id} execution started")
        
        # Get message data from inputs
        message_data = inputs.get("message_data")
        if not message_data:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No message_data input provided"
            )
        
        # Extract chat context
        chat_context = extract_chat_context(message_data)
        input_text = chat_context["input_text"]
        session_id = chat_context["session_id"]
        input_type = chat_context["input_type"]
        input_source = chat_context.get("input_source", "unknown")
        chat_id = chat_context.get("chat_id")
        bot_id = chat_context.get("bot_id")
        
        if not input_text:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No input text found in message_data"
            )
        
        # Get settings with defaults
        model = settings.get("model", "gemini-2.5-flash")
        system_prompt = settings.get("system_prompt", "You are a helpful assistant.")
        mode = settings.get("mode", "completion")
        temperature = float(settings.get("temperature", 0.7))
        max_tokens = int(settings.get("max_tokens", 1024))
        history_limit = int(settings.get("history_limit", 20))
        
        # Validate bot if in Telegram context
        if chat_id and bot_id:
            if not is_bot_active(bot_id):
                return NodeExecutionResult(
                    outputs={},
                    status="error",
                    error=f"Bot {bot_id} is not active or configured"
                )
        
        # Execute based on mode
        if mode == "chat" and should_use_chat_mode(input_source):
            return await execute_gemini_chat_mode(
                input_text=input_text,
                system_prompt=system_prompt,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                session_id=session_id,
                input_source=input_source,
                input_type=input_type,
                history_limit=history_limit,
                chat_id=chat_id,
                bot_id=bot_id
            )
        else:
            return await execute_gemini_completion_mode(
                input_text=input_text,
                system_prompt=system_prompt,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                session_id=session_id,
                input_source=input_source,
                input_type=input_type,
                chat_id=chat_id,
                bot_id=bot_id
            )
            
    except Exception as e:
        logger.error(f"Gemini chat execution error: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Gemini chat execution error: {str(e)}"
        )
