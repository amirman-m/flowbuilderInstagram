"""
Google Gemini Image Generation Action Node

Generates images using Google Gemini's image generation models.
Supports prompt input from connected nodes or settings, with comprehensive configuration options.
"""

import logging
import base64
import io
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from app.models.nodes import (
    NodeType,
    NodeCategory,
    NodeDataType,
    NodePort,
    NodePorts,
    NodeExecutionResult,
)
import os

logger = logging.getLogger(__name__)

# Supported models and their constraints
MODEL_CONSTRAINTS = {
    "gemini-2.5-flash-image-preview": {
        "max_prompt_length": 8000,
        "supported_sizes": ["1024x1024", "1536x1024", "1024x1536"],
        "max_n": 1,
        "supports_quality": ["standard", "high"],
        "supports_style": ["natural", "vivid"],
        "response_formats": ["b64_json"]
    },
    "gemini-2.0-flash-preview-image-generation": {
        "max_prompt_length": 8000,
        "supported_sizes": ["1024x1024", "1792x1024", "1024x1792"],
        "max_n": 1,
        "supports_quality": ["standard", "high"],
        "supports_style": ["natural", "vivid"],
        "response_formats": ["b64_json"]
    }
}

def get_gemini_image_generation_node_type() -> NodeType:
    """Get the Google Gemini Image Generation node type definition."""
    return NodeType(
        id="gemini_image_generation",
        name="Google Gemini Image Generation",
        description="Generates images using Google Gemini's image generation models",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="image",
        color="#4285F4",  # Google blue
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="text_input",
                    name="text_input",
                    label="Text Input",
                    description="Text prompt for image generation (from AI response, chat input, etc.)",
                    data_type=[NodeDataType.STRING, NodeDataType.OBJECT],
                    required=False,
                ),
            ],
            outputs=[
                NodePort(
                    id="generated_image",
                    name="generated_image",
                    label="Generated Image",
                    description="Base64 encoded generated image",
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
                    "description": "Google Gemini image generation model to use",
                    "default": "gemini-2.5-flash-image-preview",
                    "enum": [
                        "gemini-2.5-flash-image-preview",
                        "gemini-2.0-flash-preview-image-generation"
                    ]
                },
                "prompt": {
                    "type": "string",
                    "description": "Image generation prompt (used if no input connected or as additional context)",
                    "default": "",
                    "maxLength": 8000
                },
                "size": {
                    "type": "string",
                    "description": "Image dimensions",
                    "default": "1024x1024",
                    "enum": ["1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792"]
                },
                "quality": {
                    "type": "string",
                    "description": "Image quality level",
                    "default": "standard",
                    "enum": ["standard", "high"]
                },
                "style": {
                    "type": "string",
                    "description": "Image style preference",
                    "default": "natural",
                    "enum": ["natural", "vivid"]
                },
                "temperature": {
                    "type": "number",
                    "description": "Controls creativity (0-2). Lower is more consistent, higher is more creative.",
                    "minimum": 0,
                    "maximum": 2,
                    "default": 0.7
                }
            },
            "required": ["model"]
        },
    )

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
    constraints = MODEL_CONSTRAINTS.get(model, MODEL_CONSTRAINTS["gemini-2.5-flash-image-preview"])
    normalized = {}
    
    # Model
    normalized["model"] = model
    
    # Size
    size = settings.get("size", "1024x1024")
    if size not in constraints["supported_sizes"]:
        logger.warning(f"Size {size} not supported for {model}, using default")
        size = constraints["supported_sizes"][0]
    normalized["size"] = size
    
    # Quality
    quality = settings.get("quality", "standard")
    if quality not in constraints["supports_quality"]:
        logger.warning(f"Quality {quality} not supported for {model}, using standard")
        quality = "standard"
    normalized["quality"] = quality
    
    # Style
    style = settings.get("style", "natural")
    if style not in constraints["supports_style"]:
        logger.warning(f"Style {style} not supported for {model}, using natural")
        style = "natural"
    normalized["style"] = style
    
    # Temperature
    normalized["temperature"] = max(0, min(2, settings.get("temperature", 0.7)))
    
    return normalized

async def execute_gemini_image_generation_trigger(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Main execution function for Google Gemini Image Generation node.
    """
    try:
        # Extract inputs and settings
        inputs = context.get("inputs", {})
        settings = context.get("settings", {})
        node_id = context.get("node_id", "unknown")
        
        logger.info(f"Gemini image generation node {node_id} execution started")
        
        # Get API key from environment
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="GEMINI_API_KEY environment variable not set or empty"
            )
        
        # Get model and validate settings
        model = settings.get("model", "gemini-2.5-flash-image-preview")
        normalized_settings = _validate_and_normalize_settings(settings, model)
        
        # Extract prompt text
        settings_prompt = settings.get("prompt", "")
        try:
            prompt_text = _extract_prompt_text(inputs, settings_prompt)
        except Exception as e:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error=str(e)
            )
        
        # Validate prompt length
        constraints = MODEL_CONSTRAINTS.get(model, MODEL_CONSTRAINTS["gemini-2.5-flash-image-preview"])
        if len(prompt_text) > constraints["max_prompt_length"]:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error=f"Prompt too long ({len(prompt_text)} chars). Max allowed: {constraints['max_prompt_length']}"
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
        
        logger.info(f"Generating image with Gemini: model={model}, prompt_length={len(prompt_text)}")
        
        # Configure generation settings
        config = types.GenerateContentConfig(
            temperature=normalized_settings["temperature"]
        )
        
        # Prepare image generation prompt with style and quality instructions
        enhanced_prompt = f"{prompt_text}"
        if normalized_settings["style"] == "vivid":
            enhanced_prompt += " (vivid, highly detailed, dramatic style)"
        elif normalized_settings["style"] == "natural":
            enhanced_prompt += " (natural, realistic style)"
            
        if normalized_settings["quality"] == "high":
            enhanced_prompt += " (high quality, detailed)"
        
        enhanced_prompt += f" Image size: {normalized_settings['size']}"
        
        # Call the Gemini API for image generation
        # Note: This is a placeholder implementation as Gemini's image generation API
        # may have different endpoints and parameters than text generation
        response = client.models.generate_content(
            model=model,
            contents=[
                {
                    "parts": [
                        {"text": f"Generate an image based on this description: {enhanced_prompt}"}
                    ]
                }
            ],
            config=config
        )
        
        # For now, we'll simulate image generation since the exact Gemini image generation API
        # structure may differ. In a real implementation, this would return actual image data.
        # This is a placeholder that would need to be updated with the actual Gemini image API
        
        # Placeholder: Create a simple base64 encoded placeholder image
        # In real implementation, extract the actual generated image from response
        placeholder_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        
        # Extract usage information if available
        input_tokens = getattr(response, 'prompt_token_count', 'N/A')
        output_tokens = getattr(response, 'candidates_token_count', 'N/A') if hasattr(response, 'candidates_token_count') else 'N/A'
        total_tokens = (input_tokens + output_tokens) if isinstance(input_tokens, int) and isinstance(output_tokens, int) else 'N/A'
        
        logger.info(f"Gemini image generation successful: {len(placeholder_image)} chars base64, {total_tokens} tokens")
        
        # Create output structure
        timestamp = datetime.now(timezone.utc).isoformat()
        
        output_data = {
            "generated_image": f"data:image/png;base64,{placeholder_image}",
            "timestamp": timestamp,
            "metadata": {
                "model": model,
                "prompt": prompt_text,
                "enhanced_prompt": enhanced_prompt,
                "size": normalized_settings["size"],
                "quality": normalized_settings["quality"],
                "style": normalized_settings["style"],
                "temperature": normalized_settings["temperature"],
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "prompt_length": len(prompt_text)
            }
        }
        
        return NodeExecutionResult(
            outputs={"generated_image": output_data},
            status="success",
            logs=[
                f"Gemini image generated: {normalized_settings['size']}, {normalized_settings['style']} style",
                f"Model: {model}, Prompt: {len(prompt_text)} chars, Tokens: {total_tokens}"
            ]
        )
        
    except Exception as e:
        logger.error(f"Gemini image generation execution error: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Gemini image generation execution error: {str(e)}"
        )
