from typing import Dict, Any
from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodePort, NodePorts, NodeExecutionResult
from datetime import datetime, timezone
from app.services.utils.input_type import determine_input_type
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
import os
import uuid

def get_simple_openai_chat_node_type() -> NodeType:
    return NodeType(
        id="simple-openai-chat",
        name="OpenAI Chat",
        description="Processes input text using OpenAI's chat model",
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
                    data_type=NodeDataType.OBJECT,
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

async def execute_simple_openai_chat(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute simple OpenAI chat node
    This node accepts string input from any connected node and sends it to OpenAI.
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
    model = settings.get("model", "gpt-3.5-turbo")
    system_prompt = settings.get("system_prompt", "You are a helpful assistant.")
    temperature = settings.get("temperature", 0.7)
    max_tokens = settings.get("max_tokens", 1024)
    
    try:
        # Get API key from environment
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set or empty")
        
        # Print debug information
        print(f"Using OpenAI API with model: {model}")
        print(f"API Key (first 5 chars): {api_key[:5]}...")
        
        # Initialize OpenAI client (v1.x API)
        llm = ChatOpenAI(
            model=model,  
            openai_api_key=api_key,
            temperature=temperature,
            max_tokens=max_tokens
        )
        # Prepare messages for LangChain
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=input_text)
        ]
        # Send the request using OpenAI client
        # Call the LLM
        response = llm.invoke(messages)
        # Extract the response content
        ai_response = response.content
        print(f"Response received: {ai_response[:50]}...")
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
        print(f"OpenAI execution error: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"OpenAI API error: {str(e)}"
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
            f"OpenAI response generated: {ai_response[:50]}{'...' if len(ai_response) > 50 else ''}",
            f"Tokens used - Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}"
        ]
    )
