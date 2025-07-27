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
    "telegram-send-message-for-self": {
      category: NodeCategory.ACTION,
      subcategory: "Telegram"
    },
    // Add more nodes here in the future
    "example-action-node": {
      category: NodeCategory.ACTION,
      subcategory: "Social Media"
    }
  };