import { NodeCategory } from '../types/nodes';
import { PlayArrow as TriggerIcon, Settings as ProcessorIcon, Send as ActionIcon, AccountCircle as MyModelIcon } from '@mui/icons-material';

export type CategoryItem = {
  id: NodeCategory;
  name: string;
  color: string;
  icon: React.ElementType;
};

export const CATEGORIES: CategoryItem[] = [
  {
    id: 'trigger' as NodeCategory,
    name: 'Trigger',
    color: '#10b981',
    icon: TriggerIcon,
  },
  {
    id: 'processor' as NodeCategory,
    name: 'Processor',
    color: '#3b82f6',
    icon: ProcessorIcon,
  },
  {
    id: 'action' as NodeCategory,
    name: 'Action',
    color: '#f59e0b',
    icon: ActionIcon,
  },
  {
    id: 'my_model' as NodeCategory,
    name: 'My Model',
    color: '#8b5cf6',
    icon: MyModelIcon,
  },
];
