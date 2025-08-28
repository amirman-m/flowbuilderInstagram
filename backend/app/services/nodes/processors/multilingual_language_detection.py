from typing import Dict, Any, Optional
from datetime import datetime, timezone
import asyncio
import logging

from app.models.nodes import (
    NodeType,
    NodeCategory,
    NodeDataType,
    NodePort,
    NodePorts,
    NodeExecutionResult,
)

# Lazy model/pipeline loader
_tokenizer = None
_model = None
_pipeline = None
_loader_lock = asyncio.Lock()

# Fallback mapping for common language labels
# This ensures we always have human-readable names even if model config access fails
LANGUAGE_MAP = {
    "LABEL_0": "Arabic",
    "LABEL_1": "Basque",
    "LABEL_2": "Breton",
    "LABEL_3": "Catalan",
    "LABEL_4": "Chinese_China",
    "LABEL_5": "Chinese_Hongkong",
    "LABEL_6": "Chinese_Taiwan",
    "LABEL_7": "Chuvash",
    "LABEL_8": "Czech",
    "LABEL_9": "Dhivehi",
    "LABEL_10": "Dutch",
    "LABEL_11": "English",
    "LABEL_12": "Esperanto",
    "LABEL_13": "Estonian",
    "LABEL_14": "French",
    "LABEL_15": "Frisian",
    "LABEL_16": "Georgian",
    "LABEL_17": "German",
    "LABEL_18": "Greek",
    "LABEL_19": "Hakha_Chin",
    "LABEL_20": "Indonesian",
    "LABEL_21": "Interlingua",
    "LABEL_22": "Italian",
    "LABEL_23": "Japanese",
    "LABEL_24": "Kabyle",
    "LABEL_25": "Kinyarwanda",
    "LABEL_26": "Kyrgyz",
    "LABEL_27": "Latvian",
    "LABEL_28": "Maltese",
    "LABEL_29": "Mongolian",
    "LABEL_30": "Persian",
    "LABEL_31": "Polish",
    "LABEL_32": "Portuguese",
    "LABEL_33": "Romanian",
    "LABEL_34": "Romansh_Sursilvan",
    "LABEL_35": "Russian",
    "LABEL_36": "Sakha",
    "LABEL_37": "Slovenian",
    "LABEL_38": "Spanish",
    "LABEL_39": "Swedish",
    "LABEL_40": "Tamil",
    "LABEL_41": "Tatar",
    "LABEL_42": "Turkish",
    "LABEL_43": "Ukrainian",
    "LABEL_44": "Welsh"
}

# Abbreviation map based on the provided list. Only languages present in the list are mapped.
# Anything not present in this mapping will result in abbreviation = None.
ABBREV_MAP = {
    # Exact names we may produce + normalizations
    "afrikaans": "af",
    "amharic": "am",
    "arabic": "ar",
    "asturian": "ast",
    "azerbaijani": "az",
    "bashkir": "ba",
    "belarusian": "be",
    "bulgarian": "bg",
    "bengali": "bn",
    "breton": "br",
    "bosnian": "bs",
    "catalan": "ca",
    "valencian": "ca",
    "cebuano": "ceb",
    "czech": "cs",
    "welsh": "cy",
    "danish": "da",
    "german": "de",
    "greek": "el",
    "english": "en",
    "spanish": "es",
    "estonian": "et",
    "persian": "fa",
    "fulah": "ff",
    "finnish": "fi",
    "french": "fr",
    "western frisian": "fy",
    "frisian": "fy",  # map generic Frisian to Western Frisian code
    "irish": "ga",
    "gaelic": "gd",
    "scottish gaelic": "gd",
    "galician": "gl",
    "gujarati": "gu",
    "hausa": "ha",
    "hebrew": "he",
    "hindi": "hi",
    "croatian": "hr",
    "haitian": "ht",
    "haitian creole": "ht",
    "hungarian": "hu",
    "armenian": "hy",
    "indonesian": "id",
    "igbo": "ig",
    "iloko": "ilo",
    "icelandic": "is",
    "italian": "it",
    "japanese": "ja",
    "javanese": "jv",
    "georgian": "ka",
    "kazakh": "kk",
    "central khmer": "km",
    "khmer": "km",
    "kannada": "kn",
    "korean": "ko",
    "luxembourgish": "lb",
    "letzeburgesch": "lb",
    "ganda": "lg",
    "lingala": "ln",
    "lao": "lo",
    "lithuanian": "lt",
    "latvian": "lv",
    "malagasy": "mg",
    "macedonian": "mk",
    "malayalam": "ml",
    "mongolian": "mn",
    "marathi": "mr",
    "malay": "ms",
    "burmese": "my",
    "nepali": "ne",
    "dutch": "nl",
    "flemish": "nl",
    "norwegian": "no",
    "northern sotho": "ns",
    "occitan": "oc",
    "oriya": "or",
    "panjabi": "pa",
    "punjabi": "pa",
    "polish": "pl",
    "pushto": "ps",
    "pashto": "ps",
    "portuguese": "pt",
    "romanian": "ro",
    "moldavian": "ro",
    "moldovan": "ro",
    "russian": "ru",
    "sindhi": "sd",
    "sinhala": "si",
    "sinhalese": "si",
    "slovak": "sk",
    "slovenian": "sl",
    "somali": "so",
    "albanian": "sq",
    "serbian": "sr",
    "swati": "ss",
    "sundanese": "su",
    "swedish": "sv",
    "swahili": "sw",
    "tamil": "ta",
    "thai": "th",
    "tagalog": "tl",
    "tswana": "tn",
    "turkish": "tr",
    "ukrainian": "uk",
    "urdu": "ur",
    "uzbek": "uz",
    "vietnamese": "vi",
    "wolof": "wo",
    "xhosa": "xh",
    "yiddish": "yi",
    "yoruba": "yo",
    "chinese": "zh",
}

def _normalize_language_name(name: str) -> str:
    """Normalize language name for mapping: lowercase, replace underscores with space, strip extras.
    Handles patterns like "Language: Persian" -> "persian".
    """
    if not isinstance(name, str):
        return ""
    # Remove leading prefixes like "Language:"
    if ":" in name:
        name = name.split(":", 1)[-1]
    name = name.replace("_", " ").strip().lower()
    return name


def get_multilingual_language_detection_node_type() -> NodeType:
    return NodeType(
        id="multilingual-e5-language-detection",
        name="Language Detection",
        description=(
            "Detects the language of input text using a pretrained multilingual E5 model. "
            "This node uses a free, open‑source model and does not incur any usage charges."
        ),
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="translate",
        color="#FF9800",
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description=(
                        "text from upstream nodes. "
                    ),
                    dataType=[NodeDataType.STRING],
                    required=True,
                )
            ],
            outputs=[
                
                NodePort(
                    id="message_data",
                    name="message_data",
                    label="Message Data",
                    description=(
                        "Original payload passed along with 'detected_language' added and 'input_text' ensured."
                    ),
                    dataType=NodeDataType.STRING,
                    required=True,
                ),
            ],
        ),
        settingsSchema={
            "type": "object",
            "properties": {},
            "required": [],
        },
    )


async def _ensure_pipeline(model_name: str):
    global _tokenizer, _model, _pipeline
    if _pipeline is not None:
        return _pipeline

    async with _loader_lock:
        if _pipeline is not None:
            return _pipeline
        # Import inside to avoid importing transformers if node is unused
        from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline  # type: ignore
        # Load on CPU by default. Users with CUDA can configure via env/torch defaults.
        _tokenizer = AutoTokenizer.from_pretrained(model_name)
        _model = AutoModelForSequenceClassification.from_pretrained(model_name)
        _pipeline = pipeline(
            task="text-classification",
            model=_model,
            tokenizer=_tokenizer,
            device=-1,  # CPU
            return_all_scores=False,
        )
        return _pipeline


def _extract_text_from_inputs(inputs: Dict[str, Any]) -> (Optional[str], Optional[str], Optional[str]):
    """
    Returns (input_text, input_source, session_id).
    Priority: any dict with 'ai_response' -> any dict with 'input_text' -> any string value.
    """
    if not isinstance(inputs, dict):
        return None, None, None

    session_id = None
    # First check dict-like payloads
    for port_id, value in inputs.items():
        if isinstance(value, dict):
            if isinstance(value.get("ai_response"), str) and value["ai_response"].strip():
                return value["ai_response"].strip(), f"{port_id}.ai_response", value.get("session_id")
            if isinstance(value.get("input_text"), str) and value["input_text"].strip():
                return value["input_text"].strip(), f"{port_id}.input_text", value.get("session_id")
    # Then any raw string from any port
    for port_id, value in inputs.items():
        if isinstance(value, str) and value.strip():
            return value.strip(), port_id, session_id

    return None, None, None


async def execute_multilingual_language_detection(context: Dict[str, Any]) -> NodeExecutionResult:
    inputs = context.get("inputs", {}) or {}
    settings = context.get("settings", {}) or {}
    model_name: str = settings.get("model_name", "Mike0307/multilingual-e5-language-detection")

    input_text, input_source, session_id = _extract_text_from_inputs(inputs)
    if not input_text:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=(
                "No valid text found. Provide 'ai_response' or 'input_text' in a message_data object, "
                "or connect any node that outputs a non-empty string."
            ),
        )

    start = datetime.now(timezone.utc)
    logs = [f"Language detection using model: {model_name}", f"Input source: {input_source or 'unknown'}"]

    try:
        nlp = await _ensure_pipeline(model_name)
        # Run inference
        pred = nlp(input_text)
        # Pipeline may return a list of dicts with 'label' and 'score', or a single dict
        if isinstance(pred, list):
            top = pred[0] if pred else {"label": "unk", "score": 0.0}
        else:
            top = pred
        raw_label = str(top.get("label", "unk"))
        score = float(top.get("score", 0.0))

        # Extract a human-readable language name
        # Cases handled:
        # 1) "Language: Persian" -> "Persian"
        # 2) "Persian" -> "Persian"
        # 3) "LABEL_3" -> map via model.config.id2label if available
        if ":" in raw_label:
            language_name = raw_label.split(":", 1)[1].strip()
        else:
            language_name = raw_label.strip()

        # Map LABEL_X to real name using model config or fallback map
        if language_name.upper().startswith("LABEL_"):
            try:
                # First try our hardcoded mapping (most reliable)
                if language_name.upper() in LANGUAGE_MAP:
                    language_name = LANGUAGE_MAP[language_name.upper()]
                    logs.append(f"Mapped using hardcoded table: {language_name}")
                else:
                    # Try to use model's id2label mapping
                    idx_str = language_name.split("_", 1)[1]
                    idx = int(idx_str)
                    mapped = None
                    
                    # Debug model config access
                    if _model is None:
                        logs.append("Warning: _model is None, can't access id2label")
                    elif not hasattr(_model, "config"):
                        logs.append("Warning: _model has no config attribute")
                    elif not hasattr(_model.config, "id2label"):
                        logs.append("Warning: _model.config has no id2label attribute")
                    else:
                        id2label = _model.config.id2label  # type: ignore[attr-defined]
                        logs.append(f"id2label type: {type(id2label)}, keys: {list(id2label.keys())[:5]}...")
                        
                        # id2label can be dict with int keys or str keys
                        mapped = id2label.get(idx) if isinstance(id2label, dict) else None
                        if mapped is None:
                            mapped = id2label.get(str(idx)) if isinstance(id2label, dict) else None
                            
                    if isinstance(mapped, str) and mapped.strip():
                        language_name = mapped.strip()
                        logs.append(f"Mapped using model config: {language_name}")
                    else:
                        logs.append(f"Failed to map {language_name} using model config")
            except Exception as e:
                logs.append(f"Error mapping language name: {str(e)}")
                # If all else fails, try to use our hardcoded map as a last resort
                if language_name.upper() in LANGUAGE_MAP:
                    language_name = LANGUAGE_MAP[language_name.upper()]
                    logs.append(f"Fallback mapped using hardcoded table: {language_name}")

            
        # Compute abbreviation (two/three-letter code) if available from provided list
        norm_lang = _normalize_language_name(language_name)
        # Handle a few specific label variants produced by model mappings
        if norm_lang in {"chinese china", "chinese hongkong", "chinese taiwan"}:
            norm_lang = "chinese"
        abbrev = ABBREV_MAP.get(norm_lang)

        logs.append(f"Predicted: {language_name} (score={score:.4f}, abbrevation={abbrev if abbrev else 'None'})")

        completed = datetime.now(timezone.utc)

        # Prepare pass-through message_data
        # Try to reuse original message_data if provided; otherwise construct minimal
        message_data = None
        if isinstance(inputs, dict):
            message_data = inputs.get("message_data") if isinstance(inputs.get("message_data"), dict) else None
        if not isinstance(message_data, dict):
            message_data = {}
        # Ensure input_text present
        if not isinstance(message_data.get("input_text"), str):
            message_data["input_text"] = input_text
        # Preserve session_id if available
        if session_id and not message_data.get("session_id"):
            message_data["session_id"] = session_id
        # Attach detection
        message_data["detected_language"] = language_name
        message_data["detected_language_abbrevation"] = abbrev  # may be None
        message_data.setdefault("metadata", {})
        message_data["metadata"]["language_detection"] = {
            "model": model_name,
            "score": score,
            "raw_label": raw_label,
            "input_source": input_source,
            "abbrevation": abbrev,
        }

        outputs = {
            "detected_language": language_name,
            "abbrevation": abbrev,
            "message_data": message_data,
        }

        return NodeExecutionResult(
            outputs=outputs,
            status="success",
            logs=logs,
            started_at=start,
            completed_at=completed,
        )
    except Exception as e:
        logs.append(f"Error: {type(e).__name__}: {str(e)}")
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=str(e),
            logs=logs,
            started_at=start,
            completed_at=datetime.now(timezone.utc),
        )
