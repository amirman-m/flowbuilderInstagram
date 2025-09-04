"""
OpenAI Image Generation Action Node

Generates images using OpenAI's image generation API (DALL-E 2, DALL-E 3, or GPT-Image-1).
Supports prompt input from connected nodes or settings, with comprehensive configuration options.
"""

import logging
import base64
import io
from typing import Dict, Any, Optional, List
from openai import OpenAI
from app.models.nodes import NodeExecutionResult
import requests

logger = logging.getLogger(__name__)

# Supported models and their constraints
MODEL_CONSTRAINTS = {
    "dall-e-2": {
        "max_prompt_length": 1000,
        "supported_sizes": ["256x256", "512x512", "1024x1024"],
        "max_n": 10,
        "supports_quality": ["standard"],
        "supports_style": False,
        "response_formats": ["url", "b64_json"]
    },
    "dall-e-3": {
        "max_prompt_length": 4000,
        "supported_sizes": ["1024x1024", "1792x1024", "1024x1792"],
        "max_n": 1,
        "supports_quality": ["standard", "hd"],
        "supports_style": ["vivid", "natural"],
        "response_formats": ["url", "b64_json"]
    },
    "gpt-image-1": {
        "max_prompt_length": 32000,
        "supported_sizes": ["1024x1024", "1536x1024", "1024x1536", "auto"],
        "max_n": 10,
        "supports_quality": ["auto", "high", "medium", "low"],
        "supports_style": False,
        "response_formats": ["b64_json"],  # Always returns base64
        "supports_background": ["transparent", "opaque", "auto"],
        "supports_output_format": ["png", "jpeg", "webp"],
        "supports_compression": True,
        "supports_streaming": True
    }
}

def _extract_prompt_text(inputs: Dict[str, Any], settings_prompt: Optional[str] = None) -> str:
    """
    Extract prompt text from inputs with priority: ai_response > input_text > settings_prompt.
    If ai_response or input_text exists, append settings_prompt if provided.
    If neither exists, use settings_prompt as main prompt.
    """
    main_prompt = None
    
    # Check for string input first
    for port_id, value in inputs.items():
        if isinstance(value, str) and value.strip():
            main_prompt = value.strip()
            break
        elif isinstance(value, dict):
            # Check for ai_response first, then input_text
            for key in ["ai_response", "input_text", "chat_input", "text", "prompt", "message"]:
                if isinstance(value.get(key), str) and value[key].strip():
                    main_prompt = value[key].strip()
                    break
            if main_prompt:
                break
    
    # Combine main prompt with settings prompt
    if main_prompt and settings_prompt:
        return f"{main_prompt}. {settings_prompt}"
    elif main_prompt:
        return main_prompt
    elif settings_prompt:
        return settings_prompt
    else:
        raise Exception("No prompt provided. Please provide input text or configure a prompt in settings.")

def _validate_and_normalize_settings(settings: Dict[str, Any], model: str) -> Dict[str, Any]:
    """Validate and normalize settings based on the selected model."""
    constraints = MODEL_CONSTRAINTS.get(model, MODEL_CONSTRAINTS["dall-e-2"])
    normalized = {}
    
    # Model
    normalized["model"] = model
    
    # Size
    size = settings.get("size", "auto" if model == "gpt-image-1" else "1024x1024")
    if size not in constraints["supported_sizes"]:
        logger.warning(f"Size {size} not supported for {model}, using default")
        size = constraints["supported_sizes"][0]
    normalized["size"] = size
    
    # Number of images
    n = min(settings.get("n", 1), constraints["max_n"])
    normalized["n"] = n
    
    # Quality
    quality = settings.get("quality", "auto" if model == "gpt-image-1" else "standard")
    if quality not in constraints["supports_quality"]:
        quality = constraints["supports_quality"][0]
    normalized["quality"] = quality
    
    # Style (DALL-E 3 only)
    if constraints["supports_style"]:
        style = settings.get("style", "vivid")
        if style in ["vivid", "natural"]:
            normalized["style"] = style
    
    # Response format
    # Response format (optional; some API versions may not accept it)
    response_format = settings.get("response_format", "b64_json")
    if response_format not in constraints["response_formats"]:
        response_format = constraints["response_formats"][0]
    normalized["response_format"] = response_format
    
    # GPT-Image-1 specific settings
    if model == "gpt-image-1":
        # Background
        background = settings.get("background", "auto")
        if background in ["transparent", "opaque", "auto"]:
            normalized["background"] = background
        
        # Output format
        output_format = settings.get("output_format", "png")
        if output_format in ["png", "jpeg", "webp"]:
            normalized["output_format"] = output_format
        
        # Output compression
        compression = settings.get("output_compression", 100)
        if isinstance(compression, (int, float)) and 0 <= compression <= 100:
            normalized["output_compression"] = int(compression)
        
        # Moderation
        moderation = settings.get("moderation", "auto")
        if moderation in ["low", "auto"]:
            normalized["moderation"] = moderation
        
        # Streaming (not implemented in this version)
        normalized["stream"] = False
        
        # Partial images (not implemented in this version)
        normalized["partial_images"] = 0
    
    # User identifier
    user = settings.get("user")
    if user and isinstance(user, str):
        normalized["user"] = user
    
    return normalized

def _create_openai_client(api_key: Optional[str] = None) -> OpenAI:
    """Create OpenAI client with API key from settings or environment."""
    if api_key:
        return OpenAI(api_key=api_key)
    else:
        # Will use OPENAI_API_KEY environment variable
        return OpenAI()

def _process_image_response(response, model: str, response_format: str) -> Dict[str, Any]:
    """Process the OpenAI image generation response and return structured data."""
    if not response.data:
        raise Exception("No images generated in response")
    
    images = []
    for i, image_data in enumerate(response.data):
        image_info = {
            "index": i,
            "revised_prompt": getattr(image_data, 'revised_prompt', None)
        }
        
        if model == "gpt-image-1" or response_format == "b64_json":
            # Always base64 for gpt-image-1, or when b64_json is requested
            if hasattr(image_data, 'b64_json'):
                image_info["b64_json"] = image_data.b64_json
                image_info["format"] = "base64"
                # Decode to get byte size for metadata
                try:
                    image_bytes = base64.b64decode(image_data.b64_json)
                    image_info["size_bytes"] = len(image_bytes)
                except Exception as e:
                    logger.warning(f"Could not decode base64 image: {e}")
            else:
                raise Exception("Expected base64 image data but not found")
        else:
            # URL format for DALL-E 2/3
            if hasattr(image_data, 'url'):
                image_info["url"] = image_data.url
                image_info["format"] = "url"
            else:
                raise Exception("Expected image URL but not found")
        
        images.append(image_info)
    
    return {
        "images": images,
        "model": model,
        "total_images": len(images)
    }

async def execute_openai_image_generation(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute OpenAI image generation with comprehensive error handling and validation.
    """
    try:
        logger.info(f"🎨 Starting OpenAI Image Generation execution")
        
        settings = context.get("settings", {})
        inputs = context.get("inputs", {})
        
        # Extract and validate prompt
        settings_prompt = settings.get("prompt")
        prompt = _extract_prompt_text(inputs, settings_prompt)
        
        # Get model and validate
        model = settings.get("model", "dall-e-2")
        if model not in MODEL_CONSTRAINTS:
            logger.warning(f"Unknown model {model}, defaulting to dall-e-2")
            model = "dall-e-2"
        
        # Validate prompt length
        max_length = MODEL_CONSTRAINTS[model]["max_prompt_length"]
        if len(prompt) > max_length:
            logger.warning(f"Prompt too long ({len(prompt)} chars), truncating to {max_length}")
            prompt = prompt[:max_length]
        
        # Validate and normalize settings
        normalized_settings = _validate_and_normalize_settings(settings, model)
        
        logger.info(f"🎨 Generating image with model: {model}, prompt length: {len(prompt)}")
        
        # Create OpenAI client
        api_key = settings.get("openai_api_key")
        client = _create_openai_client(api_key)
        
        # Prepare generation parameters (only include supported params per model)
        generation_params = {
            "model": normalized_settings.get("model", "dall-e-2"),
            "prompt": prompt,
            "size": normalized_settings.get("size", "1024x1024"),
        }

        # 'n' is not supported by DALL-E 3; include for other models
        if model != "dall-e-3":
            generation_params["n"] = normalized_settings.get("n", 1)

        # 'quality' is supported by DALL-E 3; omit for others to avoid 400 unknown_parameter
        if model == "dall-e-3":
            generation_params["quality"] = normalized_settings.get("quality", "standard")
        
        # Add model-specific parameters
        if model == "dall-e-3" and "style" in normalized_settings:
            generation_params["style"] = normalized_settings["style"]
        
        if model == "gpt-image-1":
            if "background" in normalized_settings:
                generation_params["background"] = normalized_settings["background"]
            if "output_format" in normalized_settings:
                generation_params["output_format"] = normalized_settings["output_format"]
            if "output_compression" in normalized_settings:
                generation_params["output_compression"] = normalized_settings["output_compression"]
            if "moderation" in normalized_settings:
                generation_params["moderation"] = normalized_settings["moderation"]
        
        if "user" in normalized_settings:
            generation_params["user"] = normalized_settings["user"]
        
        # Generate image
        logger.info(f"🎨 Calling OpenAI API with params: {list(generation_params.keys())}")
        response = None
        try:
            # First attempt: request base64 if supported
            response = client.images.generate(**{**generation_params, "response_format": normalized_settings.get("response_format", "b64_json")})
        except Exception as e:
            err_text = str(e).lower()
            # If API rejects response_format, retry without it
            if "response_format" in err_text and "unknown parameter" in err_text:
                logger.warning("response_format not supported by API version; retrying without it")
                try:
                    response = client.images.generate(**generation_params)
                except Exception as e2:
                    # If another parameter is unknown, strip it and retry once
                    err_text2 = str(e2).lower()
                    for p in ["quality", "n", "style"]:
                        if p in err_text2 and "unknown parameter" in err_text2 and p in generation_params:
                            logger.warning(f"Parameter '{p}' not supported; retrying without it")
                            generation_params.pop(p, None)
                            break
                    response = client.images.generate(**generation_params)
            elif "unknown parameter" in err_text:
                # Strip the first offending known optional param and retry
                for p in ["quality", "n", "style", "response_format"]:
                    if p in err_text and p in generation_params:
                        logger.warning(f"Parameter '{p}' not supported; retrying without it")
                        generation_params.pop(p, None)
                        break
                response = client.images.generate(**generation_params)
            else:
                raise
        
        # Process response
        result_data = _process_image_response(response, model, normalized_settings["response_format"])
        
        # Prepare minimal output strictly for downstream compatibility
        output_data = {}
        
        # For telegram compatibility, provide the first image as a data URI when possible
        if result_data["images"]:
            first_image = result_data["images"][0]
            data_uri: Optional[str] = None
            mime = normalized_settings.get("output_format", "png")
            mime_str = f"image/{'jpeg' if mime == 'jpg' else mime}"

            if first_image.get("format") == "base64" and first_image.get("b64_json"):
                data_uri = f"data:{mime_str};base64,{first_image['b64_json']}"
            elif first_image.get("format") == "url" and first_image.get("url"):
                try:
                    resp = requests.get(first_image["url"], timeout=20)
                    resp.raise_for_status()
                    b64 = base64.b64encode(resp.content).decode("utf-8")
                    # Try to infer mime from response headers if available
                    content_type = resp.headers.get("Content-Type")
                    if content_type and content_type.startswith("image/"):
                        mime_str = content_type
                    data_uri = f"data:{mime_str};base64,{b64}"
                except Exception as fetch_err:
                    logger.warning(f"Failed to download image URL for data URI: {fetch_err}")

            if data_uri:
                output_data["photo"] = {
                    "data_uri": data_uri,
                    "format": "data_uri",
                }
            else:
                # Fallback: still provide best-effort object for downstream nodes
                output_data["photo"] = first_image
        
        logger.info(f"✅ OpenAI Image Generation completed successfully. Generated {result_data['total_images']} image(s)")
        
        return NodeExecutionResult(
            outputs=output_data,
            status="success",
        )
        
    except Exception as e:
        error_msg = f"OpenAI Image Generation failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=error_msg,
        )

def get_openai_image_generation_node_type():
    """Get the OpenAI Image Generation node type definition."""
    from app.models.nodes import (
        NodeType,
        NodeCategory,
        NodeDataType,
        NodePort,
        NodePorts,
    )

    return NodeType(
        id="openai_image_generation",
        name="OpenAI Image Generation",
        description="Generate images using OpenAI's DALL-E 2, DALL-E 3, or GPT-Image-1 models",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="openai",
        color="#7c3aed",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="prompt",
                    name="prompt",
                    label="Prompt",
                    description="Text prompt for image generation (optional if configured in settings)",
                    data_type=NodeDataType.STRING,
                    required=False,
                ),
            ],
            outputs=[
                NodePort(
                    id="photo",
                    name="photo",
                    label="Generated Image",
                    description="Generated image payload (base64 data URI)",
                    data_type=[NodeDataType.OBJECT, NodeDataType.STRING],
                    required=True,
                ),
            ],
        ),
        settings_schema={
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "title": "Prompt",
                    "description": "Text description of the desired image (optional if connected to input)",
                },
                "model": {
                    "type": "string",
                    "title": "Model",
                    "description": "Image generation model to use",
                    "enum": ["dall-e-2", "dall-e-3", "gpt-image-1"],
                    "default": "dall-e-2",
                },
                "size": {
                    "type": "string",
                    "title": "Image Size",
                    "description": "Size of generated image",
                    "enum": [
                        "256x256",
                        "512x512",
                        "1024x1024",
                        "1792x1024",
                        "1024x1792",
                        "1536x1024",
                        "auto",
                    ],
                    "default": "1024x1024",
                },
                "quality": {
                    "type": "string",
                    "title": "Quality",
                    "description": "Image quality setting",
                    "enum": ["standard", "hd", "auto", "high", "medium", "low"],
                    "default": "standard",
                },
                "style": {
                    "type": "string",
                    "title": "Style (DALL-E 3 only)",
                    "description": "Image style for DALL-E 3",
                    "enum": ["vivid", "natural"],
                    "default": "vivid",
                },
                "n": {
                    "type": "integer",
                    "title": "Number of Images",
                    "description": "Number of images to generate (1-10, DALL-E 3 only supports 1)",
                    "minimum": 1,
                    "maximum": 10,
                    "default": 1,
                },
                "response_format": {
                    "type": "string",
                    "title": "Response Format",
                    "description": "Format for returned images",
                    "enum": ["url", "b64_json"],
                    "default": "b64_json",
                },
                "openai_api_key": {
                    "type": "string",
                    "title": "OpenAI API Key",
                    "description": "OpenAI API key (optional, uses OPENAI_API_KEY env var if not provided)",
                    "format": "password",
                },
            },
        },
    )
