import React from 'react';
import { SvgIconProps } from '@mui/material';
import {
  Chat as ChatIcon,
  Mic as MicIcon,
  RecordVoiceOver as TranscriptionIcon,
  Send as SendIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import DeepSeekIcon from '../components/icons/DeepSeekIcon';
import OpenAIIcon from '../components/icons/OpenAIIcon';
import TelegramIcon from '../components/icons/TelegramIcon';

// Define types for node icons
export type NodeIconComponent = React.ComponentType<SvgIconProps>;

// Map of node type IDs to their respective icon components
export const NODE_ICONS: Record<string, NodeIconComponent> = {
  // Trigger nodes
  'chat_input': ChatIcon,
  'voice_input': MicIcon,
  'telegram_input': TelegramIcon,
  
  // Processor nodes
  'simple-openai-chat': OpenAIIcon,
  'simple-deepseek-chat': DeepSeekIcon,
  'transcription': TranscriptionIcon,
  
  // Action nodes
  'send_telegram_message': SendIcon,
  
  // Default fallback icon
  'default': CodeIcon
};

// Helper function to get the icon component for a node type
export const getNodeIcon = (nodeTypeId: string): NodeIconComponent => {
  return NODE_ICONS[nodeTypeId] || NODE_ICONS.default;
};

// Helper function to render the appropriate icon
export const renderNodeIcon = (nodeTypeId: string, props?: SvgIconProps): React.ReactNode => {
  const IconComponent = getNodeIcon(nodeTypeId);
  return React.createElement(IconComponent, props);
};
