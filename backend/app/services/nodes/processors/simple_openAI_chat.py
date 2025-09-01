from typing import Dict, Any, List
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
from app.services.utils.input_type import determine_input_type
from app.services.utils.chat_context import extract_chat_context, should_use_chat_mode
from app.services.chat_history import ChatHistoryService, ChatMessage
from app.services.bot_validation import is_bot_active
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
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

def get_simple_openai_chat_node_type() -> NodeType:
    return NodeType(
        id="simple-openai-chat",
        name="OpenAI Chat",
        description="Processes input text using OpenAI's chat model",
        category=NodeCategory.PROCESSOR,
        version="1.1.0",
        icon="chat",
        color="#2196F3",
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
                    description="The response from OpenAI",
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
                    "description": "OpenAI model to use",
                    "default": "gpt-3.5-turbo",
                    "enum": ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o3", "o4-mini", "o1", "o3-mini"]
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
                "temperature": {
                    "type": "number",
                    "description": "Controls randomness (0-2). Lower is more deterministic, higher is more creative.",
                    "minimum": 0,
                    "maximum": 2,
                    "default": 0.7
                },
                "max_tokens": {
                    "type": "integer",
                    "description": "Maximum number of tokens to generate (1-4096)",
                    "minimum": 1,
                    "maximum": 4096,
                    "default": 1024
                }
            },
            "required": ["model", "system_prompt"]
        }
    )

async def execute_completion_mode(
    input_text: str,
    system_prompt: str,
    model: str,
    temperature: float,
    max_tokens: int,
    session_id: str,
    input_source: str,
    input_type: str
) -> NodeExecutionResult:
    """
    Execute OpenAI in completion mode (single-turn)
    """
    try:
        # Get API key from environment
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set or empty")
        
        logger.info(f"OpenAI completion mode: model={model}, input_length={len(input_text)}")
           
        # Initialize OpenAI client
        llm = ChatOpenAI(
            model=model,  
            openai_api_key=api_key,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        # Prepare messages for single-turn completion
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=input_text)
        ]
        
        # Call the LLM
        response = llm.invoke(messages)
        ai_response = response.content
        
        # Extract token usage
        if hasattr(response, 'response_metadata'):
            token_usage = response.response_metadata.get('token_usage', {})
            input_tokens = token_usage.get('prompt_tokens', 'N/A')
            output_tokens = token_usage.get('completion_tokens', 'N/A')
            total_tokens = token_usage.get('total_tokens', 'N/A')
        else:
            input_tokens = output_tokens = total_tokens = 0
        
        logger.info(f"OpenAI completion successful: {len(ai_response)} chars, {total_tokens} tokens")
        
        # Create output structure
        timestamp = datetime.now(timezone.utc).isoformat()
        
        output_data = {
            "session_id": session_id,
            "input_text": input_text,
            "input_type": input_type,
            "ai_response": ai_response,
            "timestamp": timestamp,
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
                f"OpenAI completion: {ai_response[:50]}{'...' if len(ai_response) > 50 else ''}",
                f"Tokens - Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}"
            ]
        )
        
    except Exception as e:
        logger.error(f"OpenAI completion error: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"OpenAI completion error: {str(e)}"
        )

async def execute_chat_mode(
    input_text: str,
    system_prompt: str,
    model: str,
    temperature: float,
    max_tokens: int,
    session_id: str,
    input_source: str,
    input_type: str,
    chat_id: str,
    bot_id: str
) -> NodeExecutionResult:
    """
    Execute OpenAI in chat mode (multi-turn with history)
    """
    try:
        # Get API key from environment
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set or empty")
        
        logger.info(f"OpenAI chat mode: model={model}, chat_id={chat_id}, bot_id={bot_id}")
        
        # Load existing chat history
        chat_history = ChatHistoryService.load_chat_history(chat_id, bot_id)
        logger.info(f"Loaded {len(chat_history)} messages from chat history")
        
        # Initialize OpenAI client
        llm = ChatOpenAI(
            model=model,  
            openai_api_key=api_key,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        # Prepare messages with history
        messages = [SystemMessage(content=system_prompt)]
        
        # Add chat history
        for msg in chat_history:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content))  # Use AIMessage for assistant history
        
        # Add current user message
        messages.append(HumanMessage(content=input_text))
        
        logger.info(f"Prepared {len(messages)} messages for OpenAI (including system + history + current)")
        
        # Call the LLM
        response = llm.invoke(messages)
        ai_response = response.content
        
        # Extract token usage
        if hasattr(response, 'response_metadata'):
            token_usage = response.response_metadata.get('token_usage', {})
            input_tokens = token_usage.get('prompt_tokens', 'N/A')
            output_tokens = token_usage.get('completion_tokens', 'N/A')
            total_tokens = token_usage.get('total_tokens', 'N/A')
        else:
            input_tokens = output_tokens = total_tokens = 0
        
        # Update chat history with new messages
        chat_history.append(ChatMessage("user", input_text))
        chat_history.append(ChatMessage("assistant", ai_response))
        
        # Save updated history
        save_success = ChatHistoryService.save_chat_history(chat_id, bot_id, chat_history)
        if not save_success:
            logger.warning(f"Failed to save chat history for chat_id={chat_id}, bot_id={bot_id}")
        
        logger.info(f"OpenAI chat successful: {len(ai_response)} chars, {total_tokens} tokens, history_saved={save_success}")
        
        # Create output structure
        timestamp = datetime.now(timezone.utc).isoformat()
        
        output_data = {
            "session_id": session_id,
            "input_text": input_text,
            "input_type": input_type,
            "ai_response": ai_response,
            "timestamp": timestamp,
            "chat_id": chat_id,
            "bot_id": bot_id,
            "metadata": {
                "mode": "chat",
                "model": model,
                "system_prompt": system_prompt,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "input_source": input_source,
                "chat_history_length": len(chat_history),
                "history_saved": save_success
            }
        }
        
        return NodeExecutionResult(
            outputs={"ai_response": output_data},
            status="success",
            logs=[
                f"OpenAI chat: {ai_response[:50]}{'...' if len(ai_response) > 50 else ''}",
                f"Tokens - Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}",
                f"Chat history: {len(chat_history)} messages, saved: {save_success}"
            ]
        )
        
    except Exception as e:
        logger.error(f"OpenAI chat error: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"OpenAI chat error: {str(e)}"
        )

async def execute_simple_openai_chat(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute simple OpenAI chat node with support for both completion and chat modes
    """
    # Get all inputs from connected nodes
    inputs = context.get("inputs", {})
    
    # Extract input text and metadata
    input_text = None
    input_source = None
    session_id = None
    input_type = "text"  # default
    
    # Check for voice input first to skip processing
    found_voice_input = False
    for port_id, port_data in inputs.items():
        if isinstance(port_data, dict):
            input_type_val = str(port_data.get("input_type", "")).lower()
            if input_type_val == "voice" or "voice_input" in port_data:
                found_voice_input = True
                break
    
    # If voice input detected, return empty outputs (no message sent)
    if found_voice_input:
        logger.info("OpenAI chat node: Voice input detected, returning empty outputs")
        return NodeExecutionResult(
            outputs={},
            status="success",
            logs=["Voice input detected - no text processing"]
        )
    
    for port_id, port_data in inputs.items():
        if isinstance(port_data, str) and port_data.strip():
            input_text = port_data.strip()
            input_source = port_id
            break
        elif isinstance(port_data, dict):
            # PRIORITY 1: Check for ai_response first (from upstream OpenAI nodes)
            if "ai_response" in port_data and isinstance(port_data["ai_response"], str):
                input_text = port_data["ai_response"].strip()
                input_source = f"{port_id}.ai_response"
                # Extract additional metadata if available
                session_id = port_data.get("session_id")
                input_type = port_data.get("input_type", "text")
                break
            # PRIORITY 2: Check for input_text (backward compatibility and direct input)
            elif "input_text" in port_data and isinstance(port_data["input_text"], str):
                input_text = port_data["input_text"].strip()
                input_source = f"{port_id}.input_text"
                # Extract additional metadata if available
                session_id = port_data.get("session_id")
                input_type = port_data.get("input_type", "text")
                break
            # PRIORITY 3: Check for chat_input (backward compatibility)
            elif "chat_input" in port_data and isinstance(port_data["chat_input"], str):
                input_text = port_data["chat_input"].strip()
                input_source = f"{port_id}.chat_input"
                session_id = port_data.get("session_id")
                input_type = port_data.get("input_type", "text")
                break
            # DO NOT fall back to arbitrary strings to avoid processing UUIDs/session_ids
        if input_text:
            break
    
    # Generate session_id if not provided
    if not session_id:
        session_id = str(uuid.uuid4())
    
    if not input_text:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="No valid string input found from connected nodes. Please connect a node that outputs string data."
        )
    
    # Get the settings from the context
    settings = context.get("settings", {})
    mode = settings.get("mode", "completion")
    model = settings.get("model", "gpt-3.5-turbo")
    system_prompt = settings.get("system_prompt", "You are a helpful assistant.")
    temperature = settings.get("temperature", 0.7)
    max_tokens = settings.get("max_tokens", 1024)
    
    # Determine input type based on content analysis (only if not already set from connected node)
    if input_type == "text":  # Only override default, preserve from connected node
        input_type = determine_input_type(input_text)
    
    # Extract chat context for potential chat mode
    chat_id, bot_id = extract_chat_context(inputs)

    # Fallback: resolve bot_id from DB via default flow/node mapping if missing
    if (not bot_id) and context.get("flow_id") and context.get("node_id") and SessionLocal and TelegramBotConfig:
        try:
            db = SessionLocal()
            try:
                flow_id = context.get("flow_id")
                node_id = context.get("node_id")
                cfg = (
                    db.query(TelegramBotConfig)
                    .filter(
                        TelegramBotConfig.is_active == True,
                        TelegramBotConfig.default_flow_id == flow_id,
                        TelegramBotConfig.default_node_id == node_id,
                    )
                    .first()
                )
                if cfg and cfg.bot_id:
                    bot_id = str(cfg.bot_id)
                    logger.info(
                        f"Resolved bot_id from DB via flow/node mapping: flow_id={flow_id}, node_id={node_id}, bot_id={bot_id}"
                    )
            finally:
                db.close()
        except Exception as _e:
            logger.warning(f"Failed to resolve bot_id from DB mapping (flow/node): {_e}")
    
    # Validate bot if chat mode is requested
    bot_is_active = False
    if chat_id and bot_id:
        bot_is_active = is_bot_active(bot_id)
    
    # Determine execution mode
    use_chat_mode = should_use_chat_mode(mode, chat_id, bot_id, bot_is_active)
    
    logger.info(f"OpenAI execution: mode_requested={mode}, use_chat_mode={use_chat_mode}, "
               f"chat_id={chat_id}, bot_id={bot_id}, bot_active={bot_is_active}")
    
    # Execute based on determined mode
    if use_chat_mode:
        return await execute_chat_mode(
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
    else:
        return await execute_completion_mode(
            input_text=input_text,
            system_prompt=system_prompt,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            session_id=session_id,
            input_source=input_source,
            input_type=input_type
        )
