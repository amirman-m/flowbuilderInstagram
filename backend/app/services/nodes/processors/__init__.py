from app.core.node_registry import NodeRegistry
from .simple_openAI_chat import get_simple_openai_chat_node_type, execute_simple_openai_chat
from .simple_deepseek_chat import get_simple_deepseek_chat_node_type, execute_simple_deepseek_chat
from .transcription import get_transcription_node_type, execute_transcription
from .telegram_voice_downloader import get_telegram_voice_downloader_node_type, execute_telegram_voice_downloader
from .telegram_photo_downloader import get_telegram_photo_downloader_node_type, execute_telegram_photo_downloader
from .switch_input_type import get_switch_input_type_node_type, execute_switch_input_type
from .openai_speech import get_openai_speech_node_type, execute_openai_speech
from .web_scrape import get_web_scrape_node_type, execute_web_scrape
from .multilingual_language_detection import get_multilingual_language_detection_node_type, execute_multilingual_language_detection
from .language_translator import get_language_translator_node_type, execute_language_translator
from .telegram_group_event_checker import get_telegram_group_event_checker_node_type, execute_telegram_group_event_checker
from .telegram_left_chat_member_checker import get_telegram_left_chat_member_checker_node_type, execute_telegram_left_chat_member_checker
from .text_field import get_text_field_node_type, execute_text_field
from .openai_image_generation import get_openai_image_generation_node_type, execute_openai_image_generation
from .openai_image_description import get_openai_image_description_node_type, execute_openai_image_description


def register_processor_nodes(registry: NodeRegistry):
    """Register all processor nodes"""
    # Register OpenAI Chat node
    node_type = get_simple_openai_chat_node_type()
    registry.register_node(node_type, execute_simple_openai_chat)
    
    # Register DeepSeek Chat node
    node_type = get_simple_deepseek_chat_node_type()
    registry.register_node(node_type, execute_simple_deepseek_chat)
    
    # Register Transcription node
    node_type = get_transcription_node_type()
    registry.register_node(node_type, execute_transcription)
    
    # Register Download Telegram Voice node
    node_type = get_telegram_voice_downloader_node_type()
    registry.register_node(node_type, execute_telegram_voice_downloader)
    
    # Register Download Telegram Photo node
    node_type = get_telegram_photo_downloader_node_type()
    registry.register_node(node_type, execute_telegram_photo_downloader)

    # Register Switch Input Type node
    node_type = get_switch_input_type_node_type()
    registry.register_node(node_type, execute_switch_input_type)

    # Register OpenAI Speech node
    node_type = get_openai_speech_node_type()
    registry.register_node(node_type, execute_openai_speech)

    # Register Web Scraper node
    node_type = get_web_scrape_node_type()
    registry.register_node(node_type, execute_web_scrape)

    # Register Multilingual Language Detection node
    node_type = get_multilingual_language_detection_node_type()
    registry.register_node(node_type, execute_multilingual_language_detection)

    # Register Language Translator node
    node_type = get_language_translator_node_type()
    registry.register_node(node_type, execute_language_translator)

    # Register Telegram Group Event Checker node
    node_type = get_telegram_group_event_checker_node_type()
    registry.register_node(node_type, execute_telegram_group_event_checker)

    # Register Telegram Left Chat Member Checker node
    node_type = get_telegram_left_chat_member_checker_node_type()
    registry.register_node(node_type, execute_telegram_left_chat_member_checker)

    # Register Text Field node
    node_type = get_text_field_node_type()
    registry.register_node(node_type, execute_text_field)

    # Register OpenAI Image Generation node       
    openai_image_node_type = get_openai_image_generation_node_type()
    registry.register_node(openai_image_node_type, execute_openai_image_generation)

    # Register OpenAI Image Description node
    openai_image_desc_node_type = get_openai_image_description_node_type()
    registry.register_node(openai_image_desc_node_type, execute_openai_image_description)