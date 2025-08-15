// Central registry for node metadata and component information
import { NodeCategory } from '../types/nodes';

export interface NodeFeatures {
  hasSettings?: boolean;
  hasExecution?: boolean;
  hasCustomUI?: boolean;
  hasStatusIndicator?: boolean;
}

export interface NodeRegistryEntry {
  category: NodeCategory;
  subcategory: string;
  componentName: string; // The actual component file name
  features?: NodeFeatures; // Optional UI features configuration
  customStyles?: Record<string, any>; // Optional custom styling
}

export const NODE_REGISTRY: Record<string, NodeRegistryEntry> = {
    "chat_input": {
      category: NodeCategory.TRIGGER,
      subcategory: "Input Methods",
      componentName: "ChatInputNode",
      features: {
        hasSettings: false,
        hasExecution: true,
        hasCustomUI: true,
        hasStatusIndicator: true
      }
    },
    "voice_input": {
      category: NodeCategory.TRIGGER,
      subcategory: "Input Methods",
      componentName: "VoiceInputNode",
      features: {
        hasSettings: true,
        hasExecution: true,
        hasCustomUI: true,
        hasStatusIndicator: true
      }
    },
    "telegram_input": {
      category: NodeCategory.TRIGGER,
      subcategory: "Telegram",
      componentName: "TelegramInputNode",
      features: {
        hasSettings: true,
        hasExecution: true,
        hasCustomUI: true,
        hasStatusIndicator: true
      }
    },
    
    "simple-openai-chat": {
      category: NodeCategory.PROCESSOR,
      subcategory: "Chat Models",
      componentName: "OpenAIChatNode",
      features: {
        hasSettings: true,
        hasExecution: true,
        hasCustomUI: true,
        hasStatusIndicator: true
      }
    },
    "simple-deepseek-chat": {
      category: NodeCategory.PROCESSOR,
      subcategory: "Chat Models",
      componentName: "DeepSeekChatNode",
      features: {
        hasSettings: true,
        hasExecution: true,
        hasCustomUI: true,
        hasStatusIndicator: true
      }
    },
    "transcription": {
      category: NodeCategory.PROCESSOR,
      subcategory: "Audio Processing",
      componentName: "TranscriptionNode",
      features: {
        hasSettings: true,
        hasExecution: true,
        hasCustomUI: false,
        hasStatusIndicator: true
      }
    },
    "send_telegram_message": {
      category: NodeCategory.ACTION,
      subcategory: "Telegram",
      componentName: "TelegramMessageActionNode",
      features: {
        hasSettings: true,
        hasExecution: true,
        hasCustomUI: false,
        hasStatusIndicator: true
      }
    },
    "tel_send_message_for_self": {
      category: NodeCategory.ACTION,
      subcategory: "Telegram",
      componentName: "TelegramSelfMessageNode",
      features: {
        hasSettings: true,
        hasExecution: true,
        hasCustomUI: true,
        hasStatusIndicator: true
      }
    },
    "instagram_trigger": {
      category: NodeCategory.TRIGGER,
      subcategory: "Social Media",
      componentName: "InstagramTriggerNode",
      features: {
        hasSettings: true,
        hasExecution: true,
        hasCustomUI: false,
        hasStatusIndicator: true
      }
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