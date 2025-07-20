// src/components/nodes/styles.ts
import { NodeCategory } from '../../types/nodes';

export const baseNodeStyles = {
  minWidth: 200,
  minHeight: 80,
  padding: 2,
  border: '2px solid',
  borderRadius: 2,
  backgroundColor: 'white',
  cursor: 'pointer',
  '&:hover': {
    boxShadow: 3
  }
};

export const getCategoryColor = (category: NodeCategory) => {
  switch (category) {
    case NodeCategory.TRIGGER:
      return '#4CAF50'; // Green
    case NodeCategory.PROCESSOR:
      return '#2196F3'; // Blue
    case NodeCategory.ACTION:
      return '#FF9800'; // Orange
    default:
      return '#757575'; // Grey
  }
};