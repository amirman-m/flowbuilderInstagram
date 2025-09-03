import React from 'react';
import { SvgIconProps } from '@mui/material';
// Tree-shaking optimized imports - import only specific icons needed
import ChatIcon from '@mui/icons-material/Chat';
import MicIcon from '@mui/icons-material/Mic';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import SendIcon from '@mui/icons-material/Send';
import CodeIcon from '@mui/icons-material/Code';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import InfoIcon from '@mui/icons-material/Info';
import DownloadIcon from '@mui/icons-material/Download';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import PublicIcon from '@mui/icons-material/Public';
import LanguageIcon from '@mui/icons-material/Language';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
// Custom icons
import DeepSeekIcon from '../components/icons/DeepSeekIcon';
import OpenAIIcon from '../components/icons/OpenAIIcon';
import TelegramIcon from '../components/icons/TelegramIcon';

// Define types for node icons
export type NodeIconComponent = React.ComponentType<SvgIconProps>;

// Map of node type IDs to their respective icon components
// Using lazy loading for better bundle splitting
export const NODE_ICONS: Record<string, NodeIconComponent> = {
  // Trigger nodes
  'chat_input': ChatIcon,
  'voice_input': MicIcon,
  'telegram_input': TelegramIcon,
  'scheduled_message': ScheduleIcon,
  
  // Processor nodes
  'simple-openai-chat': OpenAIIcon,
  'openai_speech': OpenAIIcon,
  'simple-deepseek-chat': DeepSeekIcon,
  'transcription': RecordVoiceOverIcon,
  'download_telegram_voice': DownloadIcon,
  'switch-input-type': SwapHorizIcon,
  'web_scrape': PublicIcon,
  'multilingual-e5-language-detection': LanguageIcon,
  'language-translator-m2m100': LanguageIcon,
  'text_field': TextFieldsIcon,
  'telegram_group_event_checker': TelegramIcon,
  'telegram_left_chat_member_checker': ExitToAppIcon,
  
  // Action nodes
  'send_telegram_message': SendIcon,
  'send_telegram_voice': TelegramIcon,
  
  // Default fallback icon
  'default': CodeIcon
};

// Common UI icons for tree-shaking optimization
export const UI_ICONS = {
  Search: SearchIcon,
  Clear: ClearIcon,
  Info: InfoIcon,
  Code: CodeIcon
} as const;

export type UIIconName = keyof typeof UI_ICONS;

// Helper function to get the icon component for a node type
export const getNodeIcon = (nodeTypeId: string): NodeIconComponent => {
  return NODE_ICONS[nodeTypeId] || NODE_ICONS.default;
};

// Helper function to render the appropriate icon
export const renderNodeIcon = (nodeTypeId: string, props?: SvgIconProps): React.ReactNode => {
  const IconComponent = getNodeIcon(nodeTypeId);
  return React.createElement(IconComponent, props);
};
