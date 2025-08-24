// Hook for generating node styles based on configuration and state
import { useMemo } from 'react';
import { CSSObject } from '@mui/material/styles';
import { NodeConfiguration } from '../../../config/nodeConfiguration';
import { createNodeStyles, createHandleStyles, createStatusIndicatorStyles } from '../../../styles/nodeTheme';
import { NodeExecutionStatus } from '../../../types/nodes';

/**
 * Custom React hook for generating node styles based on configuration and current state.
 * 
 * This hook centralizes all styling logic and provides consistent styling across
 * all node components. It handles state-based styling, theming, and animations.
 * 
 * @param config - Node configuration object
 * @param options - Styling options and state
 * @returns Object containing all necessary styles for the node
 */
export interface UseNodeStylesOptions {
  selected?: boolean;
  hovered?: boolean;
  executing?: boolean;
  executionStatus?: NodeExecutionStatus;
  customState?: 'default' | 'selected' | 'executing' | 'error' | 'success' | 'hover';
}

export const useNodeStyles = (
  config: NodeConfiguration,
  options: UseNodeStylesOptions = {}
) => {
  const {
    selected = false,
    hovered = false,
    executing = false,
    executionStatus,
    customState
  } = options;

  return useMemo(() => {
    // Determine the current state
    let currentState = customState || 'default';
    
    if (executing || executionStatus === NodeExecutionStatus.RUNNING) {
      currentState = 'executing';
    } else if (executionStatus === NodeExecutionStatus.ERROR) {
      currentState = 'error';
    } else if (executionStatus === NodeExecutionStatus.SUCCESS) {
      currentState = 'success';
    } else if (selected) {
      currentState = 'selected';
    } else if (hovered) {
      currentState = 'hover';
    }

    // Generate main node styles
    const nodeStyles = createNodeStyles(
      config,
      currentState as any,
      selected,
      executionStatus
    );

    // Generate handle styles for inputs and outputs
    const inputHandleStyles = (isRequired: boolean = false, isConnected: boolean = false) =>
      createHandleStyles(config, isRequired, isConnected);

    const outputHandleStyles = (isRequired: boolean = false, isConnected: boolean = false) =>
      createHandleStyles(config, isRequired, isConnected);

    // Generate status indicator styles
    const statusIndicatorStyles = executionStatus 
      ? createStatusIndicatorStyles(executionStatus)
      : {};

    // Additional component styles
    const headerStyles: CSSObject = {
      display: 'flex',
      alignItems: 'center',
      marginBottom: 8,
      minHeight: 24
    };

    const iconStyles: CSSObject = {
      color: 'var(--node-icon-color)',
      marginRight: 8,
      display: 'flex',
      alignItems: 'center',
      fontSize: 16
    };

    const titleStyles: CSSObject = {
      flexGrow: 1,
      fontWeight: 600,
      color: 'var(--node-text-color)',
      fontSize: 13,
      lineHeight: 1.2
    };

    const categoryChipStyles: CSSObject = {
      backgroundColor: 'rgba(var(--node-color-rgb), 0.1)',
      color: 'var(--node-color)',
      fontSize: 10,
      height: 18,
      fontWeight: 500,
      border: '1px solid rgba(var(--node-color-rgb), 0.2)'
    };

    const contentStyles: CSSObject = {
      marginTop: 8,
      fontSize: 11,
      color: '#64748b',
      lineHeight: 1.3
    };

    const executionDataStyles: CSSObject = {
      marginTop: 8,
      padding: 8,
      backgroundColor: 'rgba(var(--node-color-rgb), 0.05)',
      borderRadius: 4,
      border: '1px solid rgba(var(--node-color-rgb), 0.1)',
      fontSize: 10
    };

    const actionButtonStyles: CSSObject = {
      width: 20,
      height: 20,
      color: 'var(--node-icon-color)',
      '&:hover': {
        backgroundColor: 'var(--node-color)',
        color: 'white'
      }
    };

    const deleteButtonStyles: CSSObject = {
      width: 20,
      height: 20,
      color: '#ef4444',
      '&:hover': {
        backgroundColor: '#ef4444',
        color: 'white'
      }
    };

    return {
      // Main node container styles
      node: nodeStyles,
      
      // Handle styles
      inputHandle: inputHandleStyles,
      outputHandle: outputHandleStyles,
      
      // Status indicator
      statusIndicator: statusIndicatorStyles,
      
      // Component styles
      header: headerStyles,
      icon: iconStyles,
      title: titleStyles,
      categoryChip: categoryChipStyles,
      content: contentStyles,
      executionData: executionDataStyles,
      
      // Button styles
      actionButton: actionButtonStyles,
      deleteButton: deleteButtonStyles,
      
      // State helpers
      isSelected: selected,
      isHovered: hovered,
      isExecuting: executing,
      currentState,
      
      // Color helpers
      primaryColor: config.color,
      categoryColor: config.color,
      accentColor: `${config.color}20`,
      borderColor: selected ? config.color : 'rgba(0, 0, 0, 0.12)',
      
      // Animation helpers
      shouldAnimate: currentState === 'executing' || currentState === 'error',
      animationType: currentState === 'executing' ? 'pulse' : currentState === 'error' ? 'shake' : null
    };
  }, [config, selected, hovered, executing, executionStatus, customState]);
};

export default useNodeStyles;
