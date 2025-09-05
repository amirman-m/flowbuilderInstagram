from typing import Dict, Any, Optional
from datetime import datetime, timezone
import base64
import logging
import os
import uuid

from app.models.nodes import (
    NodeType,
    NodeCategory,
    NodeDataType,
    NodePort,
    NodePorts,
    NodeExecutionResult,
)

logger = logging.getLogger(__name__)


def get_gemini_image_description_node_type() -> NodeType:
    """Get the Google Gemini Image Description node type definition."""
    return NodeType(
        id="gemini_image_description",
        name="Google Gemini Image Description",
        description="Analyzes images using Google Gemini vision models and generates textual descriptions",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="image_search",
        color="#4285F4",  # Google blue
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
                    "description": "Google Gemini vision model to use",
                    "default": "gemini-2.5-flash",
                    "enum": [
                        "gemini-2.5-pro",
                        "gemini-2.5-flash", 
                        "gemini-2.0-flash",
                        "gemini-2.5-flash-image-preview"
                    ]
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
                    "description": "Maximum number of tokens to generate (1-8192)",
                    "minimum": 1,
                    "maximum": 8192,
                    "default": 1000
                }
            },
            "required": ["model", "system_prompt"]
        },
    )


def extract_base64_image(photo_input: Any) -> Optional[str]:
    """Extract base64 image data from various input formats."""
    try:
        if isinstance(photo_input, str):
            # Handle data URI format: data:image/jpeg;base64,/9j/4AAQ...
            if photo_input.startswith('data:image/'):
                if ';base64,' in photo_input:
                    return photo_input.split(';base64,')[1]
                else:
                    logger.warning("Image data URI found but no base64 data")
                    return None
            # Handle raw base64 string
            elif len(photo_input) > 100 and photo_input.isalnum():
                return photo_input
            else:
                logger.warning(f"Unrecognized image string format: {photo_input[:50]}...")
                return None
                
        elif isinstance(photo_input, dict):
            # Handle message_data format from Telegram photo downloader
            if 'photo_input' in photo_input:
                return extract_base64_image(photo_input['photo_input'])
            elif 'image_data' in photo_input:
                return extract_base64_image(photo_input['image_data'])
            elif 'base64' in photo_input:
                return extract_base64_image(photo_input['base64'])
            else:
                logger.warning(f"No recognized image field in dict: {list(photo_input.keys())}")
                return None
                
        elif isinstance(photo_input, bytes):
            # Convert bytes to base64
            return base64.b64encode(photo_input).decode('utf-8')
            
        else:
            logger.warning(f"Unsupported photo input type: {type(photo_input)}")
            return None
            
    except Exception as e:
        logger.error(f"Error extracting base64 image: {str(e)}")
        return None


def extract_text_context(text_input: Any) -> str:
    """Extract text context from various input formats."""
    try:
        if isinstance(text_input, str):
            return text_input
        elif isinstance(text_input, dict):
            # Handle message_data format
            if 'input_text' in text_input:
                return text_input['input_text']
            elif 'text' in text_input:
                return text_input['text']
            elif 'message' in text_input:
                return text_input['message']
            else:
                return ""
        else:
            return str(text_input) if text_input else ""
    except Exception as e:
        logger.error(f"Error extracting text context: {str(e)}")
        return ""


async def execute_gemini_image_description_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Main execution function for Google Gemini Image Description node.
    """
    try:
        # Extract inputs and settings
        inputs = context.get("inputs", {})
        settings = context.get("settings", {})
        node_id = context.get("node_id", "unknown")
        
        logger.info(f"Gemini image description node {node_id} execution started")
        
        # Get photo input (required)
        photo_input = inputs.get("photo")
        if not photo_input:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No photo input provided. Connect an image source to the 'photo' input port."
            )
        
        # Extract base64 image data
        base64_image = extract_base64_image(photo_input)
        if not base64_image:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="Could not extract valid base64 image data from input. Ensure the image is in base64 format."
            )
        
        # Get optional text context
        text_input = inputs.get("text_input")
        additional_context = extract_text_context(text_input) if text_input else ""
        
        # Get settings with defaults
        model = settings.get("model", "gemini-2.5-flash")
        system_prompt = settings.get("system_prompt", "You are an expert image analyst. Provide a detailed, accurate description of the image, including objects, people, settings, colors, mood, and any text visible in the image.")
        temperature = float(settings.get("temperature", 0.3))
        max_tokens = int(settings.get("max_tokens", 1000))
        
        # Get API key from environment
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="GEMINI_API_KEY environment variable not set or empty"
            )
        
        # Import Google Gemini client
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="google-genai package not installed. Run: pip install google-genai"
            )
        
        # Initialize Gemini client
        client = genai.Client(api_key=api_key)
        
        # Prepare the prompt
        if additional_context:
            prompt_text = f"{system_prompt}\n\nAdditional context: {additional_context}\n\nPlease analyze this image:"
        else:
            prompt_text = f"{system_prompt}\n\nPlease analyze this image:"
        
        # Prepare image content for Gemini
        image_content = {
            "mime_type": "image/jpeg",  # Assume JPEG, Gemini handles most formats
            "data": base64_image
        }
        
        # Configure generation settings
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            thinking_config=types.ThinkingConfig(thinking_budget=0)  # Disable thinking
        )
        
        # Call the Gemini API with image and text
        response = client.models.generate_content(
            model=model,
            contents=[
                {
                    "parts": [
                        {"text": prompt_text},
                        {"inline_data": image_content}
                    ]
                }
            ],
            config=config
        )
        
        ai_response = response.text
        
        # Extract usage information if available
        input_tokens = getattr(response, 'prompt_token_count', 'N/A')
        output_tokens = getattr(response, 'candidates_token_count', 'N/A') if hasattr(response, 'candidates_token_count') else 'N/A'
        total_tokens = (input_tokens + output_tokens) if isinstance(input_tokens, int) and isinstance(output_tokens, int) else 'N/A'
        
        logger.info(f"Gemini image description successful: {len(ai_response)} chars, {total_tokens} tokens")
        
        # Create output structure
        timestamp = datetime.now(timezone.utc).isoformat()
        
        output_data = {
            "ai_response": ai_response,
            "timestamp": timestamp,
            "metadata": {
                "model": model,
                "system_prompt": system_prompt,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "additional_context": additional_context,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "image_size_kb": len(base64_image) * 3 / 4 / 1024  # Approximate size
            }
        }
        
        return NodeExecutionResult(
            outputs={"ai_response": output_data},
            status="success",
            logs=[
                f"Gemini image analysis: {ai_response[:50]}{'...' if len(ai_response) > 50 else ''}",
                f"Model: {model}, Tokens: {total_tokens}, Image size: ~{len(base64_image) * 3 / 4 / 1024:.1f}KB"
            ]
        )
        
    except Exception as e:
        logger.error(f"Gemini image description execution error: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Gemini image description execution error: {str(e)}"
        )
