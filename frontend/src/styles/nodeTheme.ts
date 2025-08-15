// Centralized node theming system
import { NodeCategory, NodeExecutionStatus } from '../types/nodes';
import { NodeConfiguration, CATEGORY_COLORS } from '../config/nodeConfiguration';
import { CSSObject } from '@mui/material/styles';

// Node state types
export type NodeState = 'default' | 'selected' | 'executing' | 'error' | 'success' | 'hover';

// Base style definitions
export interface NodeStyles {
  minWidth: number;
  minHeight: number;
  padding: number;
  borderRadius: number;
  borderWidth: number;
  fontSize: string;
  fontWeight: string | number;
  cursor: string;
  position: string;
  transition: string;
}

// State-specific style variations
export interface StateStyles {
  borderColor?: string;
  backgroundColor?: string;
  boxShadow?: string;
  transform?: string;
  opacity?: number;
  animation?: string;
}

// Category-specific style variations
export interface CategoryVariant {
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  iconColor: string;
  textColor: string;
}

// Complete theme definition
export interface NodeTheme {
  base: NodeStyles;
  variants: Record<NodeCategory, CategoryVariant>;
  states: Record<NodeState, StateStyles>;
  animations: Record<string, CSSObject>;
}

// Base node styles (shared across all nodes)
const BASE_NODE_STYLES: NodeStyles = {
  minWidth: 200,
  minHeight: 80,
  padding: 16,
  borderRadius: 12,
  borderWidth: 2,
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  position: 'relative',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
};

// Category-specific variants
const CATEGORY_VARIANTS: Record<NodeCategory, CategoryVariant> = {
  [NodeCategory.TRIGGER]: {
    accentColor: CATEGORY_COLORS[NodeCategory.TRIGGER],
    gradientFrom: '#10b981',
    gradientTo: '#059669',
    iconColor: '#065f46',
    textColor: '#064e3b'
  },
  [NodeCategory.PROCESSOR]: {
    accentColor: CATEGORY_COLORS[NodeCategory.PROCESSOR],
    gradientFrom: '#3b82f6',
    gradientTo: '#2563eb',
    iconColor: '#1e40af',
    textColor: '#1e3a8a'
  },
  [NodeCategory.ACTION]: {
    accentColor: CATEGORY_COLORS[NodeCategory.ACTION],
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    iconColor: '#92400e',
    textColor: '#78350f'
  },
  [NodeCategory.MY_MODEL]: {
    accentColor: CATEGORY_COLORS[NodeCategory.MY_MODEL],
    gradientFrom: '#8b5cf6',
    gradientTo: '#7c3aed',
    iconColor: '#5b21b6',
    textColor: '#4c1d95'
  }
};

// State-specific styles
const STATE_STYLES: Record<NodeState, StateStyles> = {
  default: {
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    opacity: 1
  },
  selected: {
    borderColor: 'currentColor',
    backgroundColor: 'rgba(var(--node-color-rgb), 0.05)',
    boxShadow: '0 4px 12px rgba(var(--node-color-rgb), 0.15)',
    transform: 'translateY(-1px)'
  },
  hover: {
    backgroundColor: 'rgba(var(--node-color-rgb), 0.02)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    transform: 'translateY(-0.5px)'
  },
  executing: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
    animation: 'pulse 2s infinite'
  },
  success: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)'
  },
  error: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.2)',
    animation: 'shake 0.5s ease-in-out'
  }
};

// Animation definitions
const ANIMATIONS: Record<string, CSSObject> = {
  pulse: {
    '@keyframes pulse': {
      '0%, 100%': {
        opacity: 1
      },
      '50%': {
        opacity: 0.8
      }
    }
  },
  shake: {
    '@keyframes shake': {
      '0%, 100%': {
        transform: 'translateX(0)'
      },
      '10%, 30%, 50%, 70%, 90%': {
        transform: 'translateX(-2px)'
      },
      '20%, 40%, 60%, 80%': {
        transform: 'translateX(2px)'
      }
    }
  },
  slideIn: {
    '@keyframes slideIn': {
      '0%': {
        transform: 'translateY(10px)',
        opacity: 0
      },
      '100%': {
        transform: 'translateY(0)',
        opacity: 1
      }
    }
  }
};

// Complete theme object
export const NODE_THEME: NodeTheme = {
  base: BASE_NODE_STYLES,
  variants: CATEGORY_VARIANTS,
  states: STATE_STYLES,
  animations: ANIMATIONS
};

// Style generation functions
export const createNodeStyles = (
  config: NodeConfiguration,
  state: NodeState = 'default',
  isSelected: boolean = false,
  executionStatus?: NodeExecutionStatus
): CSSObject => {
  const variant = NODE_THEME.variants[config.category];
  const baseStyles = NODE_THEME.base;
  
  // Determine the current state
  let currentState = state;
  if (executionStatus === NodeExecutionStatus.RUNNING) {
    currentState = 'executing';
  } else if (executionStatus === NodeExecutionStatus.ERROR) {
    currentState = 'error';
  } else if (executionStatus === NodeExecutionStatus.SUCCESS) {
    currentState = 'success';
  } else if (isSelected) {
    currentState = 'selected';
  }
  
  const stateStyles = NODE_THEME.states[currentState];
  
  // CSS custom properties for dynamic theming
  const cssVariables = {
    '--node-color': variant.accentColor,
    '--node-color-rgb': hexToRgb(variant.accentColor),
    '--node-gradient-from': variant.gradientFrom,
    '--node-gradient-to': variant.gradientTo,
    '--node-icon-color': variant.iconColor,
    '--node-text-color': variant.textColor
  };
  
  return {
    ...cssVariables,
    ...baseStyles,
    ...stateStyles,
    // Apply custom styles from configuration
    ...config.customStyles,
    // Ensure border color uses the variant color when selected
    borderColor: isSelected ? variant.accentColor : stateStyles.borderColor,
    // Add animations if specified
    ...(stateStyles.animation && NODE_THEME.animations[stateStyles.animation.split(' ')[0]])
  };
};

// Handle styles for input/output ports
export const createHandleStyles = (
  config: NodeConfiguration,
  isRequired: boolean = false,
  isConnected: boolean = false
): CSSObject => {
  const variant = NODE_THEME.variants[config.category];
  
  return {
    width: 12,
    height: 12,
    border: '2px solid #ffffff',
    backgroundColor: isRequired ? variant.accentColor : '#94a3b8',
    boxShadow: isConnected 
      ? `0 0 0 2px ${variant.accentColor}40` 
      : '0 1px 3px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: variant.accentColor,
      transform: 'scale(1.1)',
      boxShadow: `0 0 0 3px ${variant.accentColor}40`
    }
  };
};

// Status indicator styles
export const createStatusIndicatorStyles = (
  status: NodeExecutionStatus
): CSSObject => {
  const statusColors = {
    [NodeExecutionStatus.PENDING]: '#94a3b8',
    [NodeExecutionStatus.RUNNING]: '#3b82f6',
    [NodeExecutionStatus.SUCCESS]: '#10b981',
    [NodeExecutionStatus.ERROR]: '#ef4444'
  };
  
  return {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: statusColors[status] || '#94a3b8',
    boxShadow: `0 0 0 2px #ffffff, 0 0 6px ${statusColors[status] || '#94a3b8'}40`,
    ...(status === NodeExecutionStatus.RUNNING && {
      animation: 'pulse 1.5s infinite'
    })
  };
};

// Utility functions
const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';
  
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ].join(', ');
};

// Theme utilities for components
export const getThemeColor = (category: NodeCategory): string => {
  return CATEGORY_COLORS[category];
};

export const getVariant = (category: NodeCategory): CategoryVariant => {
  return NODE_THEME.variants[category];
};

// Export for backward compatibility
export const baseNodeStyles = BASE_NODE_STYLES;
export const getCategoryColor = getThemeColor;
