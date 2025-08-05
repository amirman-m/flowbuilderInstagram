// Central registry for node metadata
import { NodeCategory } from '../types/nodes';
export const NODE_REGISTRY: Record<string, { category: NodeCategory; subcategory: string }> = {
    "chat_input": {
      category: NodeCategory.TRIGGER,
      subcategory: "Test inputs"
    },
    "voice_input": {
      category: NodeCategory.TRIGGER,
      subcategory: "Test inputs"
    },
    "telegram_input": {
      category: NodeCategory.TRIGGER,
      subcategory: "Telegram"
    },
    
    "simple-openai-chat": {
      category: NodeCategory.PROCESSOR,
      subcategory: "Chat Models"
    },
    "simple-deepseek-chat": {
      category: NodeCategory.PROCESSOR,
      subcategory: "Chat Models"
    },
    "transcription": {
      category: NodeCategory.PROCESSOR,
      subcategory: "Transcriptions"
    },
    "send_telegram_message": {
      category: NodeCategory.ACTION,
      subcategory: "Telegram"
    },
    // Add more nodes here in the future
    
  };