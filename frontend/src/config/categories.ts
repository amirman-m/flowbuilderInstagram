import { NodeCategory } from '../types/nodes';
import { PlayArrow as TriggerIcon, Settings as ProcessorIcon, Send as ActionIcon, AccountCircle as MyModelIcon } from '@mui/icons-material';
import { SvgIconProps } from '@mui/material';

export type CategoryItem = {
  id: NodeCategory;
  name: string;
  color: string;
  icon: React.ComponentType<SvgIconProps>;
  key?: string; // Optional unique key for React rendering
};

export const CATEGORIES: CategoryItem[] = [
  {
    id: NodeCategory.TRIGGER,
    name: 'Trigger',
    color: '#10b981',
    icon: TriggerIcon as React.ComponentType<SvgIconProps>,
    key: 'trigger-category'
  },
  {
    id: NodeCategory.PROCESSOR,
    name: 'Processor',
    color: '#3b82f6',
    icon: ProcessorIcon as React.ComponentType<SvgIconProps>,
    key: 'processor-category'
  },
  {
    id: NodeCategory.ACTION,
    name: 'Action',
    color: '#f59e0b',
    icon: ActionIcon as React.ComponentType<SvgIconProps>,
    key: 'action-category'
  },
  {
    id: NodeCategory.MY_MODEL,
    name: 'My Model',
    color: '#8b5cf6',
    icon: MyModelIcon as React.ComponentType<SvgIconProps>,
    key: 'my-model-category'
  },
];
