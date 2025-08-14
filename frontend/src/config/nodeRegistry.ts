// Central registry for node metadata and component information
import { NodeCategory } from '../types/nodes';

export interface NodeRegistryEntry {
  category: NodeCategory;
  subcategory: string;
  componentName: string; // The actual component file name
}

export const NODE_REGISTRY: Record<string, NodeRegistryEntry> = {
    "chat_input": {
      category: NodeCategory.TRIGGER,
      subcategory: "Test inputs",
      componentName: "ChatInputNode"
    },
    "voice_input": {
      category: NodeCategory.TRIGGER,
      subcategory: "Test inputs",
      componentName: "VoiceInputNode"
    },
    "telegram_input": {
      category: NodeCategory.TRIGGER,
      subcategory: "Telegram",
      componentName: "TelegramInputNode"
    },
    
    "simple-openai-chat": {
      category: NodeCategory.PROCESSOR,
      subcategory: "Chat Models",
      componentName: "OpenAIChatNode"
    },
    "simple-deepseek-chat": {
      category: NodeCategory.PROCESSOR,
      subcategory: "Chat Models",
      componentName: "DeepSeekChatNode"
    },
    "transcription": {
      category: NodeCategory.PROCESSOR,
      subcategory: "Transcriptions",
      componentName: "TranscriptionNode"
    },
    "send_telegram_message": {
      category: NodeCategory.ACTION,
      subcategory: "Telegram",
      componentName: "TelegramMessageActionNode"
    },
    "instagram_trigger": {
      category: NodeCategory.TRIGGER,
      subcategory: "Social Media",
      componentName: "InstagramTriggerNode"
    },
    // Add more nodes here in the future
    
  };

// Helper function to get all registered node IDs
export const getRegisteredNodeIds = (): string[] => {
  return Object.keys(NODE_REGISTRY);
};

// Helper function to get component name for a node ID
export const getComponentName = (nodeTypeId: string): string => {
  return NODE_REGISTRY[nodeTypeId]?.componentName || 'UnknownNode';
};