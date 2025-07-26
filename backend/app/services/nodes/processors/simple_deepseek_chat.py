from typing import Dict, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
from app.services.utils.input_type import determine_input_type
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
import os
import uuid
import asyncio
import concurrent.futures

def get_simple_deepseek_chat_node_type() -> NodeType:
    return NodeType(
        id="simple-deepseek-chat",
        name="DeepSeek Chat",
        description="Processes input text using DeepSeek's chat model",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
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
                    "description": "DeepSeek model to use",
                    "default": "deepseek-chat",
                    "enum": ["deepseek-chat", "deepseek-reasoner"]
                },
                "system_prompt": {
                    "type": "string",
                    "description": "System prompt to guide the AI response. Define the AI's role, personality, and behavior in detail.",
                    "default": "You are a helpful assistant.",
                    "minLength": 1,
                    "maxLength": 2000
                },
                "temperature": {
                    "type": "number",
                    "description": "Controls randomness (0-2). Lower is more deterministic, higher is more creative.",
                    "minimum": 0,
                    "maximum": 2,
                    "default": 0.7
                }
            },
            "required": ["model", "system_prompt"]
        }
    )

async def execute_simple_deepseek_chat(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute simple DeepSeek chat node
    This node accepts string input from any connected node and sends it to DeepSeek.
    """
    # Get all inputs from connected nodes
    inputs = context.get("inputs", {})
    
    # Find the first string input from any connected node
    input_text = None
    input_source = None
    session_id = None
    input_type = "text"  # default
    
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
            # PRIORITY 3: Check for any other string value in the dict
            else:
                for key, value in port_data.items():
                    if isinstance(value, str) and value.strip():
                        input_text = value.strip()
                        input_source = f"{port_id}.{key}"
                        break
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
    model = settings.get("model", "deepseek-chat")
    system_prompt = settings.get("system_prompt", "You are a helpful assistant.")
    temperature = settings.get("temperature", 0.7)
    max_tokens = 1024  # default value
    
    # Check if API key is set in environment
    if not os.environ.get("DEEPSEEK_API_KEY"):
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="DEEPSEEK_API_KEY environment variable not set"
        )
    
    try:
        # Get API key from environment
        api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not api_key:
            raise ValueError("DEEPSEEK_API_KEY environment variable not set or empty")  
        # Print debug information
        print(f"Using DeepSeek API with model: {model}")
        print(f"API Key (first 5 chars): {api_key[:5]}...")      
        # Initialize LangChain ChatOpenAI with DeepSeek configuration with timeout
        print("Initializing DeepSeek ChatOpenAI client...")
        llm = ChatOpenAI(
            model=model,  # e.g., "deepseek-chat" or "deepseek-coder"
            openai_api_key=api_key,
            openai_api_base="https://api.deepseek.com/v1",  # DeepSeek API base URL
            temperature=temperature,
            max_tokens=max_tokens,
            request_timeout=30  # Add 30 second timeout
        )
        print("DeepSeek ChatOpenAI client initialized successfully")
            
        # Prepare messages for LangChain
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=input_text)
        ]
        print(f"Prepared messages: System={len(system_prompt)} chars, Human={len(input_text)} chars")
        
        # Call the LLM with additional error handling
        print("Calling DeepSeek API...")
        try:
            # Use asyncio.wait_for to add timeout protection
            response = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None, 
                    lambda: llm.invoke(messages)
                ),
                timeout=45  # 45 second total timeout
            )
            print("Response received from DeepSeek API successfully")
        except asyncio.TimeoutError:
            print("DeepSeek API call timed out after 45 seconds")
            raise Exception("DeepSeek API call timed out. The service may be unavailable or overloaded.")
        except Exception as api_error:
            print(f"DeepSeek API call failed with error: {str(api_error)}")
            print(f"Error type: {type(api_error).__name__}")
            raise api_error
            
        # Extract the response content
        ai_response = response.content
        print(f"Response content type: {type(ai_response)}")
        print(f"Response content length: {len(ai_response) if ai_response else 0}")
        print(f"Response content preview: {ai_response[:100] if ai_response else 'None'}...")
        
        # Validate response content
        if not ai_response or not isinstance(ai_response, str):
            raise ValueError(f"Invalid response from DeepSeek API: content is {type(ai_response)} with value {ai_response}")
        if hasattr(response, 'response_metadata'):
            token_usage = response.response_metadata.get('token_usage', {})
        # Get token usage
            input_tokens = token_usage.get('prompt_tokens', 'N/A')
            output_tokens = token_usage.get('completion_tokens', 'N/A')
            total_tokens = token_usage.get('total_tokens', 'N/A')
        else:
            print("\nToken usage data not available in response.")
            input_tokens = 0
            output_tokens = 0
            total_tokens = 0
    except Exception as e:
        print(f"DeepSeek API execution error: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        
        # Try with a different model name as fallback
        try:
            print("\nAttempting fallback with different model name...")
            fallback_model = "deepseek-llm" if model == "deepseek-chat" else "deepseek-chat"
            print(f"Using fallback model: {fallback_model}")
            
            llm = ChatOpenAI(
                model=fallback_model,
                openai_api_key=api_key,
                openai_api_base="https://api.deepseek.com/v1",
                temperature=temperature,
                max_tokens=max_tokens,
                request_timeout=30
            )
            
            # Prepare messages for LangChain
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=input_text)
            ]
            
            # Call the LLM with timeout
            print("Calling DeepSeek API with fallback model...")
            response = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None, 
                    lambda: llm.invoke(messages)
                ),
                timeout=45
            )
            print("Response received from DeepSeek API with fallback model")
            
            # Extract the response content
            ai_response = response.content
            print(f"Fallback response content type: {type(ai_response)}")
            print(f"Fallback response content preview: {ai_response[:100]}...")
            
            # Extract token usage if available
            if hasattr(response, 'response_metadata'):
                print("Response metadata available for fallback")
                token_usage = response.response_metadata.get('token_usage', {})
                print(f"Token usage: {token_usage}")
                input_tokens = token_usage.get('prompt_tokens', 'N/A')
                output_tokens = token_usage.get('completion_tokens', 'N/A')
                total_tokens = token_usage.get('total_tokens', 'N/A')
            else:
                print("Token usage data not available in fallback response.")
                input_tokens = 0
                output_tokens = 0
                total_tokens = 0
                
            # Create comprehensive output structure
            timestamp = datetime.now(timezone.utc).isoformat()
            
            # Determine input type based on content analysis
            if input_type == "text":
                input_type = determine_input_type(input_text)
            
            output_data = {
                "session_id": session_id,
                "input_text": input_text,
                "input_type": input_type,
                "ai_response": ai_response,
                "timestamp": timestamp,
                "metadata": {
                    "model": fallback_model,
                    "system_prompt": system_prompt,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                    "input_source": input_source,
                    "note": "Used fallback model due to error with primary model"
                }
            }
            
            # Return the comprehensive response
            return NodeExecutionResult(
                outputs={"ai_response": output_data},
                status="success",
                logs=[
                    f"DeepSeek response generated with fallback model: {ai_response[:50]}{'...' if len(ai_response) > 50 else ''}",
                    f"Tokens used - Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}",
                    f"Original error: {str(e)}"
                ]
            )
            
        except Exception as fallback_error:
            print(f"Fallback attempt also failed: {str(fallback_error)}")
            print(f"Fallback error type: {type(fallback_error).__name__}")
            traceback.print_exc()
            
            # Final error response with detailed information
            error_details = {
                "primary_error": str(e),
                "primary_error_type": type(e).__name__,
                "fallback_error": str(fallback_error),
                "fallback_error_type": type(fallback_error).__name__,
                "model_attempted": model,
                "api_endpoint": "https://api.deepseek.com/v1",
                "troubleshooting": "Check DeepSeek API key validity and service availability"
            }
            
            return NodeExecutionResult(
                outputs={},
                status="error",
                error=f"DeepSeek API failed: {str(e)}. Fallback failed: {str(fallback_error)}. Details: {error_details}"
            )
    
    # Create comprehensive output structure
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Determine input type based on content analysis (only if not already set from connected node)
    if input_type == "text":  # Only override default, preserve from connected node
        input_type = determine_input_type(input_text)
    
    output_data = {
        "session_id": session_id,
        "input_text": input_text,
        "input_type": input_type,
        "ai_response": ai_response,
        "timestamp": timestamp,
        "metadata": {
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
    
    # Return the comprehensive response
    return NodeExecutionResult(
        outputs={"ai_response": output_data},
        status="success",
        logs=[
            f"DeepSeek response generated: {ai_response[:50]}{'...' if len(ai_response) > 50 else ''}",
            f"Tokens used - Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}"
        ]
    )