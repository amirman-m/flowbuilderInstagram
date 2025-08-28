"""
Language Translator Node

This node translates text from one language to another using Facebook's M2M100 model.
It accepts message_data as input and outputs the translated text.
"""
from typing import Dict, Any, Tuple, Optional, List, cast
import logging
from datetime import datetime

from transformers import M2M100ForConditionalGeneration, M2M100Tokenizer  # type: ignore

from app.models.nodes import NodeType, NodeCategory, NodeDataType, NodeExecutionResult


# Logger for this module
logger = logging.getLogger(__name__)

# Dictionary mapping language names to their ISO codes
LANG_CODE_TITLES = {
    "af": "Afrikaans",
    "am": "Amharic",
    "ar": "Arabic",
    "ast": "Asturian",
    "az": "Azerbaijani",
    "ba": "Bashkir",
    "be": "Belarusian",
    "bg": "Bulgarian",
    "bn": "Bengali",
    "br": "Breton",
    "bs": "Bosnian",
    "ca": "Catalan; Valencian",
    "ceb": "Cebuano",
    "cs": "Czech",
    "cy": "Welsh",
    "da": "Danish",
    "de": "German",
    "el": "Greek",
    "en": "English",
    "es": "Spanish",
    "et": "Estonian",
    "fa": "Persian",
    "ff": "Fulah",
    "fi": "Finnish",
    "fr": "French",
    "fy": "Western Frisian",
    "ga": "Irish",
    "gd": "Gaelic; Scottish Gaelic",
    "gl": "Galician",
    "gu": "Gujarati",
    "ha": "Hausa",
    "he": "Hebrew",
    "hi": "Hindi",
    "hr": "Croatian",
    "ht": "Haitian; Haitian Creole",
    "hu": "Hungarian",
    "hy": "Armenian",
    "id": "Indonesian",
    "ig": "Igbo",
    "ilo": "Iloko",
    "is": "Icelandic",
    "it": "Italian",
    "ja": "Japanese",
    "jv": "Javanese",
    "ka": "Georgian",
    "kk": "Kazakh",
    "km": "Central Khmer",
    "kn": "Kannada",
    "ko": "Korean",
    "lb": "Luxembourgish; Letzeburgesch",
    "lg": "Ganda",
    "ln": "Lingala",
    "lo": "Lao",
    "lt": "Lithuanian",
    "lv": "Latvian",
    "mg": "Malagasy",
    "mk": "Macedonian",
    "ml": "Malayalam",
    "mn": "Mongolian",
    "mr": "Marathi",
    "ms": "Malay",
    "my": "Burmese",
    "ne": "Nepali",
    "nl": "Dutch; Flemish",
    "no": "Norwegian",
    "ns": "Northern Sotho",
    "oc": "Occitan (post 1500)",
    "or": "Oriya",
    "pa": "Panjabi; Punjabi",
    "pl": "Polish",
    "ps": "Pushto; Pashto",
    "pt": "Portuguese",
    "ro": "Romanian; Moldavian; Moldovan",
    "ru": "Russian",
    "sd": "Sindhi",
    "si": "Sinhala; Sinhalese",
    "sk": "Slovak",
    "sl": "Slovenian",
    "so": "Somali",
    "sq": "Albanian",
    "sr": "Serbian",
    "ss": "Swati",
    "su": "Sundanese",
    "sv": "Swedish",
    "sw": "Swahili",
    "ta": "Tamil",
    "th": "Thai",
    "tl": "Tagalog",
    "tn": "Tswana",
    "tr": "Turkish",
    "uk": "Ukrainian",
    "ur": "Urdu",
    "uz": "Uzbek",
    "vi": "Vietnamese",
    "wo": "Wolof",
    "xh": "Xhosa",
    "yi": "Yiddish",
    "yo": "Yoruba",
    "zh": "Chinese",
    "zu": "Zulu",
}

# Singleton pattern for model and tokenizer to avoid reloading
_translation_model = None
_translation_tokenizer = None


def get_translation_model_and_tokenizer() -> Tuple[M2M100ForConditionalGeneration, M2M100Tokenizer]:
    """
    Load and return the translation model and tokenizer.
    Uses a singleton pattern to avoid reloading the model for each execution.
    """
    global _translation_model, _translation_tokenizer
    if _translation_model is not None and _translation_tokenizer is not None:
        return _translation_model, _translation_tokenizer
    
    # Import inside to avoid importing transformers if node is unused
    from transformers import M2M100ForConditionalGeneration, M2M100Tokenizer  # type: ignore
    _translation_model = M2M100ForConditionalGeneration.from_pretrained("facebook/m2m100_418M")
    _translation_tokenizer = M2M100Tokenizer.from_pretrained("facebook/m2m100_418M")
    return _translation_model, _translation_tokenizer


def get_language_translator_node_type() -> NodeType:
    # Create language options list for dropdown menus
    language_options = []
    for code, title in LANG_CODE_TITLES.items():
        language_options.append({"const": code, "title": title})
    
    return NodeType(
        id="language-translator-m2m100",
        name="Language Translator",
        description=(
            "Translate input text from a source language to a target language using Facebook's M2M100 (418M) model. "
            "This node uses a free, open-source model and does not incur any usage charges."
        ),
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="translate",
        ports=dict(
            inputs=[
                dict(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Message data containing text to translate.",
                    dataType=NodeDataType.OBJECT,
                    required=True,
                ),
            ],
            outputs=[
                dict(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description="Output payload with the translated text set on input_text.",
                    dataType=NodeDataType.OBJECT,
                    required=True,
                ),
            ],
        ),
        settingsSchema={
            "type": "object",
            "properties": {
                "target_language": {
                    "type": "string",
                    "title": "Target Language",
                    "oneOf": language_options,
                },
                "source_language": {
                    "type": "string",
                    "title": "Source Language (optional)",
                    "oneOf": language_options,
                },
            },
            "required": ["target_language"],
        },
    )


async def execute_language_translator(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute the language translation process.
    
    Steps:
    1. Extract input text from message_data or ai_response
    2. Determine source language (from settings or detected from input)
    3. Translate text using M2M100 model
    4. Return translated text in message_data and as standalone output
    """
    try:
        # Get settings
        settings = context.get("settings", {})
        target_language = settings.get("target_language")
        source_language = settings.get("source_language")
        
        # Get inputs
        inputs = context.get("inputs", {})
        
        if not target_language:
            return NodeExecutionResult(
                status="error",
                error="Target language is required. Please configure it in node settings.",
                outputs={},
            )
        
        # Extract input text from message_data or ai_response
        input_text = _extract_input_text(inputs)
        if not input_text:
            return NodeExecutionResult(
                status="error",
                error="No input text found in message_data or ai_response.",
                outputs={},
            )
        
        # If source language not provided in settings, try to get from input metadata
        if not source_language:
            source_language = _extract_source_language(inputs)
        
        # If still no source language, default to auto-detection (None)
        if not source_language:
            logger.info("No source language specified or detected. Model will attempt auto-detection.")
            return NodeExecutionResult(
                    status="error",
                    error="No input text found in message_data or ai_response.",
                    outputs={},
                )
        # Perform translation
        translated_text = await _translate_text(
            text=input_text,
            source_lang=source_language,
            target_lang=target_language
        )
        
        # Create output message_data with translation
        message_data = _create_output_message_data(
            inputs,
            input_text,
            translated_text,
            source_language,
            target_language
        )
        
        # Return successful result
        return NodeExecutionResult(
            status="success",
            outputs={
                "message_data": message_data,
            },
            logs=[
                f"Translated text from {source_language or 'auto-detected'} to {target_language}",
                f"Original text length: {len(input_text)}, Translated text length: {len(translated_text)}"
            ]
        )
        
    except Exception as e:
        logger.exception(f"Error in language translation: {str(e)}")
        return NodeExecutionResult(
            status="error",
            error=f"Translation error: {str(e)}",
            outputs={},
        )

def _extract_input_text(inputs: Dict[str, Any]) -> Optional[str]:
    """
    Extract input text from message_data or ai_response.
    Returns None if no text is found.
    """
    # Try to get from message_data
    if "message_data" in inputs:
        message_data = inputs["message_data"]
        if isinstance(message_data, dict):
            # Direct input_text field
            if "input_text" in message_data and message_data["input_text"]:
                return str(message_data["input_text"])
            
            # Check for content in ai_response
            if "ai_response" in message_data and message_data["ai_response"]:
                ai_response = message_data["ai_response"]
                if isinstance(ai_response, dict) and "content" in ai_response:
                    return str(ai_response["content"])
                elif isinstance(ai_response, str):
                    return ai_response
    
    # Try to get from ai_response
    if "ai_response" in inputs:
        ai_response = inputs["ai_response"]
        if isinstance(ai_response, dict) and "content" in ai_response:
            return str(ai_response["content"])
        elif isinstance(ai_response, str):
            return ai_response
    
    return None

def _extract_source_language(inputs: Dict[str, Any]) -> Optional[str]:
    """
    Try to extract source language from input metadata.
    Returns None if no language is found.
    """
    # Check for detected_language_abbrevation in message_data
    if "message_data" in inputs and isinstance(inputs["message_data"], dict):
        message_data = inputs["message_data"]
        
        # Direct field in message_data
        if "detected_language_abbrevation" in message_data:
            return message_data["detected_language_abbrevation"]
        
        # Check in metadata
        if "metadata" in message_data and isinstance(message_data["metadata"], dict):
            metadata = message_data["metadata"]
            
            # Check language_detection metadata
            if "language_detection" in metadata and isinstance(metadata["language_detection"], dict):
                lang_detection = metadata["language_detection"]
                if "abbrevation" in lang_detection:
                    return lang_detection["abbrevation"]
    
    return None

async def _translate_text(text: str, source_lang: Optional[str], target_lang: str) -> str:
    """
    Translate text using the M2M100 model.
    """
    model, tokenizer = get_translation_model_and_tokenizer()
    
    # Set source language if provided
    if source_lang:
        tokenizer.src_lang = source_lang
    
    # Encode input text
    encoded_input = tokenizer(text, return_tensors="pt")
    
    # Generate translation with target language token
    generated_tokens = model.generate(
        **encoded_input,
        forced_bos_token_id=tokenizer.get_lang_id(target_lang)
    )
    
    # Decode and return translation
    translation = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]
    return translation

def _create_output_message_data(
    inputs: Dict[str, Any],
    original_text: str,
    translated_text: str,
    source_lang: Optional[str],
    target_lang: str
) -> Dict[str, Any]:
    """
    Create output message_data with translation metadata.
    """
    # Start with existing message_data or create new one
    if "message_data" in inputs and isinstance(inputs["message_data"], dict):
        message_data = dict(inputs["message_data"])
    else:
        message_data = {
            "session_id": "",
            "timestamp": datetime.utcnow().isoformat(),
            "input_type": "string",
        }
    
    # Store original text before translation
    message_data["input_text_before_translation"] = original_text
    
    # Update input_text with translated text
    message_data["input_text"] = translated_text
    
    # Add or update metadata
    if "metadata" not in message_data:
        message_data["metadata"] = {}
    
    # Add translation metadata
    message_data["metadata"]["translation"] = {
        "model": "facebook/m2m100_418M",
        "source_language": source_lang or "auto-detected",
        "target_language": target_lang,
        "result_field": "input_text",
        "source_text_length": len(original_text) if original_text else 0,
        "translated_text_length": len(translated_text) if translated_text else 0,
    }
    
    return message_data
