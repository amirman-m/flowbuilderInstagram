from typing import Dict, Any, Optional
from datetime import datetime, timezone
import base64
import logging
import os
import uuid
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage

from app.models.nodes import (
    NodeType,
    NodeCategory,
    NodeDataType,
    NodePort,
    NodePorts,
    NodeExecutionResult,
)

logger = logging.getLogger(__name__)


def get_openai_image_description_node_type() -> NodeType:
    """Get the OpenAI Image Description node type definition."""
    return NodeType(
        id="openai_image_description",
        name="OpenAI Image Description",
        description="Analyzes images using GPT-4o vision and generates textual descriptions",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="image_search",
        color="#10A37F",  # OpenAI green
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="photo",
                    name="photo",
                    label="Photo",
                    description="Image data (base64 data URI or binary data) to analyze",
                    data_type=[NodeDataType.OBJECT, NodeDataType.STRING],
                    required=True,
                ),
                NodePort(
                    id="text_input",
                    name="text_input", 
                    label="Additional Context",
                    description="Optional text input to add context or specific questions about the image",
                    data_type=[NodeDataType.STRING, NodeDataType.OBJECT],
                    required=False,
                ),
            ],
            outputs=[
                NodePort(
                    id="ai_response",
                    name="ai_response",
                    label="AI Response",
                    description="Generated description of the image",
                    data_type=[NodeDataType.STRING],
                    required=True,
                ),
            ],
        ),
        settings_schema={
            "type": "object",
            "properties": {
                "model": {
                    "type": "string",
                    "description": "OpenAI vision model to use",
                    "default": "gpt-4o",
                    "enum": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4-vision-preview"]
                },
                "system_prompt": {
                    "type": "string",
                    "description": "System prompt to guide the image analysis. Define what aspects to focus on.",
                    "default": "You are an expert image analyst. Provide a detailed, accurate description of the image, including objects, people, settings, colors, mood, and any text visible in the image.",
                    "minLength": 1,
                    "maxLength": 2000
                },
                "temperature": {
                    "type": "number",
                    "description": "Controls creativity (0-2). Lower is more factual, higher is more creative.",
                    "minimum": 0,
                    "maximum": 2,
                    "default": 0.3
                },
                "max_tokens": {
                    "type": "integer",
                    "description": "Maximum number of tokens to generate (1-4096)",
                    "minimum": 1,
                    "maximum": 4096,
                    "default": 1000
                },
                "detail_level": {
                    "type": "string",
                    "description": "Level of detail for image analysis",
                    "default": "high",
                    "enum": ["low", "high"]
                }
            },
            "required": ["model", "system_prompt"]
        },
    )


def _extract_image_data(photo_input: Any) -> Optional[str]:
    """Extract base64 image data from various input formats.
    
    Args:
        photo_input: Can be a data URI string, base64 string, or dict with photo data
        
    Returns:
        Base64 image data string or None if extraction fails
    """
    try:
        if isinstance(photo_input, str):
            # Handle data URI format: data:image/jpeg;base64,/9j/4AAQ...
            if photo_input.startswith("data:"):
                if ";base64," in photo_input:
                    return photo_input.split(";base64,", 1)[1]
                else:
                    logger.warning("Data URI found but no base64 encoding detected")
                    return None
            # Handle plain base64 string
            elif len(photo_input) > 100 and photo_input.replace("+", "").replace("/", "").replace("=", "").isalnum():
                return photo_input
            else:
                logger.warning(f"String input doesn't appear to be valid image data: {photo_input[:50]}...")
                return None
                
        elif isinstance(photo_input, dict):
            # Handle message_data format from telegram_photo_downloader
            if "photo_input" in photo_input:
                return _extract_image_data(photo_input["photo_input"])
            # Handle other dict formats that might contain image data
            for key in ["image", "photo", "data", "base64"]:
                if key in photo_input:
                    return _extract_image_data(photo_input[key])
                    
        elif isinstance(photo_input, bytes):
            # Handle raw bytes
            return base64.b64encode(photo_input).decode("ascii")
            
        logger.warning(f"Unsupported photo input format: {type(photo_input)}")
        return None
        
    except Exception as e:
        logger.error(f"Error extracting image data: {e}")
        return None


def _extract_text_context(text_input: Any) -> str:
    """Extract text context from various input formats.
    
    Args:
        text_input: Can be a string, dict with text fields, or other formats
        
    Returns:
        Extracted text string (empty if no valid text found)
    """
    try:
        if isinstance(text_input, str):
            return text_input.strip()
            
        elif isinstance(text_input, dict):
            # Priority order for text extraction
            text_fields = ["ai_response", "input_text", "chat_input", "text", "message", "content"]
            for field in text_fields:
                if field in text_input and isinstance(text_input[field], str):
                    text = text_input[field].strip()
                    if text:
                        return text
                        
        return ""
        
    except Exception as e:
        logger.error(f"Error extracting text context: {e}")
        return ""


async def execute_openai_image_description(context: Dict[str, Any]) -> NodeExecutionResult:
    """Execute OpenAI Image Description node.
    
    Analyzes an image using GPT-4o vision and generates a textual description.
    """
    started = datetime.now(timezone.utc)
    
    try:
        # Get API key
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="OPENAI_API_KEY environment variable not set",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            )
        
        # Extract inputs
        inputs = context.get("inputs", {})
        settings = context.get("settings", {})
        
        # Get image data (required)
        photo_data = None
        for port_id, value in inputs.items():
            if port_id == "photo" or "photo" in str(port_id).lower():
                photo_data = value
                break
                
        if not photo_data:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No photo input found. Please connect an image source.",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            )
        
        # Extract base64 image data
        base64_image = _extract_image_data(photo_data)
        if not base64_image:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Could not extract valid image data from input. Expected base64 data URI or base64 string.",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            )
        
        # Get optional text context
        additional_context = ""
        for port_id, value in inputs.items():
            if port_id == "text_input" or "text" in str(port_id).lower():
                additional_context = _extract_text_context(value)
                break
        
        # Get settings
        model = settings.get("model", "gpt-4o")
        system_prompt = settings.get("system_prompt", "You are an expert image analyst. Provide a detailed, accurate description of the image.")
        temperature = settings.get("temperature", 0.3)
        max_tokens = settings.get("max_tokens", 1000)
        detail_level = settings.get("detail_level", "high")
        
        # Build the prompt
        user_prompt = "Please analyze this image and provide a detailed description."
        if additional_context:
            user_prompt += f"\n\nAdditional context or specific questions: {additional_context}"
        
        # Initialize OpenAI client
        llm = ChatOpenAI(
            model=model,
            openai_api_key=api_key,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        # Prepare messages with image
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(
                content=[
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}",
                            "detail": detail_level
                        }
                    }
                ]
            )
        ]
        
        logger.info(f"OpenAI Image Description: model={model}, detail={detail_level}, context_length={len(additional_context)}")
        
        # Call the LLM
        response = llm.invoke(messages)
        ai_response = response.content
        
        # Extract token usage
        token_usage = {}
        if hasattr(response, 'response_metadata'):
            token_usage = response.response_metadata.get('token_usage', {})
        
        input_tokens = token_usage.get('prompt_tokens', 'N/A')
        output_tokens = token_usage.get('completion_tokens', 'N/A')
        total_tokens = token_usage.get('total_tokens', 'N/A')
        
        logger.info(f"OpenAI Image Description successful: {len(ai_response)} chars, {total_tokens} tokens")
        
        # Generate session ID
        session_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create output structure
        output_data = {
            "session_id": session_id,
            "ai_response": ai_response,
            "input_type": "image",
            "timestamp": timestamp,
            "metadata": {
                "model": model,
                "system_prompt": system_prompt,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "detail_level": detail_level,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "has_additional_context": bool(additional_context),
                "additional_context_length": len(additional_context),
                "image_size_bytes": len(base64_image) if base64_image else 0
            }
        }
        
        return NodeExecutionResult(
            outputs={"ai_response": output_data},
            status="success",
            logs=[
                f"Image analyzed successfully: {ai_response[:100]}{'...' if len(ai_response) > 100 else ''}",
                f"Tokens - Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}",
                f"Model: {model}, Detail: {detail_level}" + (f", Context: {len(additional_context)} chars" if additional_context else "")
            ],
            started_at=started,
            completed_at=datetime.now(timezone.utc),
        )
        
    except Exception as e:
        logger.error(f"Error in execute_openai_image_description: {e}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"OpenAI Image Description error: {str(e)}",
            started_at=started,
            completed_at=datetime.now(timezone.utc),
        )
