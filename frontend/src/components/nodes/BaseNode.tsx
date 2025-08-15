// BaseNode - Core shared functionality for all node components
import React, { useState, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Paper, 
  Box, 
  Typography, 
  IconButton, 
  Chip,
  Tooltip,
  CircularProgress
} from '@mui/material';
import { 
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  PlayArrow as ExecuteIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon
} from '@mui/icons-material';

import { NodeComponentProps, NodeDataWithHandlers } from './registry';
import { NodeConfiguration, getNodeConfiguration, getCategoryColor, getCategoryGradient } from '../../config/nodeConfiguration';
import { createNodeStyles, createHandleStyles, createStatusIndicatorStyles, NODE_THEME } from '../../styles/nodeTheme';
import { NodeExecutionStatus, NodeCategory } from '../../types/nodes';
import { useExecutionData } from './hooks/useExecutionData';

// Extended props for BaseNode
export interface BaseNodeProps extends NodeComponentProps {
  nodeTypeId?: string;
  nodeConfig?: NodeConfiguration;
  children?: React.ReactNode;
  customContent?: React.ReactNode;
  onExecute?: () => Promise<void> | void;
  onSettings?: () => void;
  onSettingsClick?: () => void; // Alternative name for settings handler
  executionStatus?: NodeExecutionStatus;
  validationState?: 'error' | 'success' | 'none'; // Validation state for nodes
  isExecuting?: boolean; // External execution state
  hideDefaultContent?: boolean;
  customHeader?: React.ReactNode;
  customFooter?: React.ReactNode;
  icon?: React.ReactNode; // Custom icon for the node
}

// Status icon mapping
const STATUS_ICONS = {
  [NodeExecutionStatus.PENDING]: PendingIcon,
  [NodeExecutionStatus.RUNNING]: CircularProgress,
  [NodeExecutionStatus.SUCCESS]: SuccessIcon,
  [NodeExecutionStatus.ERROR]: ErrorIcon
};

export const BaseNode: React.FC<BaseNodeProps> = ({
  nodeTypeId,
  data,
  selected = false,
  id,
  children,
  customContent,
  onExecute,
  onSettings,
  executionStatus,
  hideDefaultContent = false,
  customHeader,
  customFooter
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Get node configuration
  const config = useMemo(() => nodeTypeId ? getNodeConfiguration(nodeTypeId) : undefined, [nodeTypeId]);
  
  // Extract node data
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeDelete, onNodeUpdate, flowId } = nodeData;
  
  // Use execution data hook for fresh results
  const executionData = useExecutionData(nodeData);
  
  // Fallback configuration if not found
  const safeConfig: NodeConfiguration = config || {
    id: nodeTypeId || 'unknown-node', // Ensure id is always a string
    category: NodeCategory.PROCESSOR,
    subcategory: 'Unknown',
    name: 'Unknown Node',
    description: 'Unknown node type',
    icon: () => null,
    color: '#757575',
    componentName: 'UnknownNode',
    features: {
      hasSettings: false,
      hasExecution: true, // Enable execution by default for all nodes
      hasCustomUI: false,
      hasStatusIndicator: true
    }
  };
  
  // Determine current execution status
  const currentStatus = executionStatus || 
    executionData?.status || 
    instance?.data?.lastExecution?.status;
  
  // Generate styles based on configuration and state
  const nodeStyles = useMemo(() => 
    createNodeStyles(
      safeConfig, 
      isHovered ? 'hover' : 'default',
      selected,
      currentStatus
    ), 
    [safeConfig, isHovered, selected, currentStatus]
  );
  
  // Handle delete action
  const handleDelete = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (onNodeDelete && id) {
      onNodeDelete(id);
    }
  }, [onNodeDelete, id]);
  
  // Handle settings action
  const handleSettings = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (onSettings) {
      onSettings();
    }
  }, [onSettings]);
  
  // Handle execute action
  const handleExecute = useCallback(async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onExecute && !isExecuting) {
      try {
        setIsExecuting(true);
        await onExecute();
      } catch (error) {
        console.error('Node execution failed:', error);
      } finally {
        setIsExecuting(false);
      }
    }
  }, [onExecute, isExecuting]);
  
  // Render status icon
  const renderStatusIcon = () => {
    if (!safeConfig.features.hasStatusIndicator || !currentStatus) return null;
    
    const IconComponent = STATUS_ICONS[currentStatus as keyof typeof STATUS_ICONS];
    if (!IconComponent) return null;
    
    const statusStyles = createStatusIndicatorStyles(currentStatus);
    
    if (currentStatus === NodeExecutionStatus.RUNNING) {
      return (
        <Box sx={statusStyles}>
          <CircularProgress size={8} thickness={6} />
        </Box>
      );
    }
    
    return (
      <Box sx={statusStyles}>
        <IconComponent 
          sx={{ 
            fontSize: 8,
            color: 'white'
          }} 
        />
      </Box>
    );
  };
  
  // Render input handles
  const renderInputHandles = () => {
    if (!nodeType?.ports?.inputs) return null;
    
    return nodeType.ports.inputs.map((port: any, index: number) => {
      const isRequired = port.required || safeConfig.ports?.requiredInputs?.includes(port.id);
      const handleStyles = createHandleStyles(safeConfig, isRequired);
      const topPosition = `${30 + (index * 25)}px`;
      
      // Create a clean style object for React
      const cleanStyles: React.CSSProperties = {
        top: topPosition,
        width: (handleStyles as any).width || 12,
        height: (handleStyles as any).height || 12,
        border: (handleStyles as any).border || '2px solid #ffffff',
        backgroundColor: (handleStyles as any).backgroundColor || '#94a3b8',
        boxShadow: (handleStyles as any).boxShadow || '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: (handleStyles as any).transition || 'all 0.2s ease'
      };
      
      return (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={cleanStyles}
        >
          <Tooltip title={String(port.label || port.name) + ": " + String(port.description || '')} placement="left">
            <Box />
          </Tooltip>
        </Handle>
      );
    });
  };
  
  // Render output handles
  const renderOutputHandles = () => {
    if (!nodeType?.ports?.outputs) return null;
    
    return nodeType.ports.outputs.map((port: any, index: number) => {
      const isRequired = port.required || safeConfig.ports?.requiredOutputs?.includes(port.id);
      const handleStyles = createHandleStyles(safeConfig, isRequired);
      const topPosition = `${30 + (index * 25)}px`;
      
      // Create a clean style object for React
      const cleanStyles: React.CSSProperties = {
        top: topPosition,
        width: (handleStyles as any).width || 12,
        height: (handleStyles as any).height || 12,
        border: (handleStyles as any).border || '2px solid #ffffff',
        backgroundColor: (handleStyles as any).backgroundColor || '#94a3b8',
        boxShadow: (handleStyles as any).boxShadow || '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: (handleStyles as any).transition || 'all 0.2s ease'
      };
      
      return (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={cleanStyles}
        >
          <Tooltip title={`${String(port.label || port.name)}: ${String(port.description || '')}`} placement="right">
            <Box />
          </Tooltip>
        </Handle>
      );
    });
  };
  
  // Render node header
  const renderHeader = () => {
    if (customHeader) return customHeader;
    
    const IconComponent = safeConfig.icon;
    const gradient = getCategoryGradient(safeConfig.category);

    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        p: 2,
        pb: 1.5,
      }}>
        {/* Icon and Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {IconComponent && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: 32, 
              height: 32,
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${gradient.primary}, ${gradient.secondary})`,
              color: 'white',
              boxShadow: `0 4px 12px ${gradient.primary}30`
            }}>
              <IconComponent sx={{ fontSize: 18 }} />
            </Box>
          )}
          <Box>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 600,
                color: '#0f172a',
                fontSize: '0.95rem',
                lineHeight: 1.2
              }}
            >
              {instance?.label || safeConfig.name}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: '#64748b',
                fontSize: '0.75rem',
                textTransform: 'lowercase'
              }}
            >
              {safeConfig.category}
            </Typography>
          </Box>
        </Box>
        
        {/* Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Status Icon */}
          {renderStatusIcon()}
          
          {/* Settings Button */}
          {safeConfig.features.hasSettings && onSettings && (
            <IconButton
              size="small"
              onClick={handleSettings}
              sx={{
                width: 28,
                height: 28,
                borderRadius: '8px',
                color: '#64748b',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                '&:hover': {
                  backgroundColor: `${gradient.primary}10`,
                  color: gradient.primary,
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <SettingsIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
          
          {/* Execute Button */}
          {safeConfig.features.hasExecution && onExecute && (
            <IconButton
              size="small"
              onClick={handleExecute}
              disabled={isExecuting}
              sx={{
                width: 28,
                height: 28,
                borderRadius: '8px',
                color: 'white',
                background: `linear-gradient(135deg, ${gradient.primary}, ${gradient.secondary})`,
                boxShadow: `0 2px 8px ${gradient.primary}30`,
                '&:hover': {
                  transform: 'scale(1.05)',
                  boxShadow: `0 4px 12px ${gradient.primary}40`
                },
                '&.Mui-disabled': {
                  background: 'linear-gradient(135deg, #94a3b8, #64748b)',
                  color: 'white',
                  opacity: 0.6
                },
                transition: 'all 0.2s ease'
              }}
            >
              <ExecuteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
          
          {/* Delete Button */}
          <IconButton
            size="small"
            onClick={handleDelete}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '8px',
              color: '#64748b',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              '&:hover': {
                backgroundColor: '#fef2f2',
                color: '#ef4444',
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      </Box>
    );
  };
  
  
  // Render default content
  const renderDefaultContent = () => {
    if (hideDefaultContent) return null;
    
    return (
      <Box sx={{ mt: 1 }}>
        {/* Description */}
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#64748b',
            fontSize: '11px',
            lineHeight: 1.3,
            display: 'block',
            mb: 1
          }}
        >
          {safeConfig.description}
        </Typography>
        
        {/* Execution Data Display */}
        {executionData && (
          <Box sx={{ 
            mt: 1, 
            p: 1, 
            backgroundColor: 'rgba(var(--node-color-rgb), 0.05)',
            borderRadius: 1,
            border: '1px solid rgba(var(--node-color-rgb), 0.1)'
          }}>
            <Typography variant="caption" sx={{ fontSize: '10px', color: '#64748b' }}>
              Last execution: {executionData.lastExecuted || 'Never'}
            </Typography>
            {executionData.displayData && (
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '10px', 
                  color: 'var(--node-text-color)',
                  display: 'block',
                  mt: 0.5,
                  wordBreak: 'break-word'
                }}
              >
                {(() => {
                  const { displayData } = executionData;
                  let text = '';
                  
                  if (displayData.type === 'message_data') {
                    text = displayData.inputText || 'No input text';
                  } else if (displayData.type === 'ai_response') {
                    text = displayData.aiResponse || 'No AI response';
                  } else if (displayData.type === 'raw' && displayData.data) {
                    text = JSON.stringify(displayData.data);
                  } else {
                    text = 'No output data';
                  }
                  
                  return text.substring(0, 50);
                })()}
                {(() => {
                  const { displayData } = executionData;
                  let text = '';
                  
                  if (displayData.type === 'message_data') {
                    text = displayData.inputText || '';
                  } else if (displayData.type === 'ai_response') {
                    text = displayData.aiResponse || '';
                  } else if (displayData.type === 'raw' && displayData.data) {
                    text = JSON.stringify(displayData.data);
                  }
                  
                  return text.length > 50 ? '...' : '';
                })()}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );
  };
  
  const gradient = getCategoryGradient(safeConfig.category);

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        width: 300,
        height: 180,
        minWidth: 300,
        minHeight: 180,
        maxWidth: 300,
        maxHeight: 180,
        borderRadius: '20px',
        background: selected 
          ? `linear-gradient(135deg, ${gradient.primary}15 0%, ${gradient.accent} 100%)`
          : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: selected 
          ? `2px solid ${gradient.primary}` 
          : `1px solid ${gradient.primary}20`,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isHovered 
          ? `0 20px 40px ${gradient.primary}20, 0 8px 16px rgba(0, 0, 0, 0.1)`
          : `0 8px 24px ${gradient.primary}10, 0 2px 8px rgba(0, 0, 0, 0.05)`,
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0px)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status Indicator */}
      {renderStatusIcon()}
      
      {/* Input Handles */}
      {renderInputHandles()}
      
      {/* Node Content */}
      <Box sx={{ 
        position: 'relative', 
        zIndex: 1, 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '12px'
      }}>
        {/* Header */}
        {renderHeader()}
        
        
        {/* Custom Content */}
        {customContent}
        
        {/* Default Content */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {renderDefaultContent()}
          {children}
        </Box>
        
        {/* Custom Footer */}
        {customFooter}
      </Box>
      
      {/* Output Handles */}
      {renderOutputHandles()}
    </Paper>
  );
};
