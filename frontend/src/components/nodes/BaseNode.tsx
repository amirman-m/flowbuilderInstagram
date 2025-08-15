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
import { NodeConfiguration, getNodeConfiguration } from '../../config/nodeConfiguration';
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
    
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        mb: 1,
        minHeight: 24
      }}>
        {/* Node Icon */}
        {IconComponent && (
          <Box sx={{ 
            color: 'var(--node-icon-color)', 
            mr: 1,
            display: 'flex',
            alignItems: 'center'
          }}>
            <IconComponent fontSize="small" />
          </Box>
        )}
        
        {/* Node Title */}
        <Typography 
          variant="subtitle2" 
          sx={{ 
            flexGrow: 1, 
            fontWeight: 600,
            color: 'var(--node-text-color)',
            fontSize: '13px',
            lineHeight: 1.2
          }}
        >
          {instance?.label || safeConfig.name}
        </Typography>
        
        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
          {/* Settings Button */}
          {safeConfig.features.hasSettings && (
            <Tooltip title="Settings">
              <IconButton 
                size="small" 
                onClick={handleSettings}
                sx={{ 
                  width: 20, 
                  height: 20,
                  color: 'var(--node-icon-color)',
                  '&:hover': {
                    backgroundColor: 'var(--node-color)',
                    color: 'white'
                  }
                }}
              >
                <SettingsIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
          
          {/* Execute Button */}
          {safeConfig.features.hasExecution && (
            <Tooltip title="Execute">
              <IconButton 
                size="small" 
                onClick={handleExecute}
                disabled={isExecuting}
                sx={{ 
                  width: 20, 
                  height: 20,
                  color: 'var(--node-icon-color)',
                  '&:hover': {
                    backgroundColor: 'var(--node-color)',
                    color: 'white'
                  }
                }}
              >
                {isExecuting ? (
                  <CircularProgress size={12} />
                ) : (
                  <ExecuteIcon fontSize="inherit" />
                )}
              </IconButton>
            </Tooltip>
          )}
          
          {/* Delete Button */}
          <Tooltip title="Delete">
            <IconButton 
              size="small" 
              onClick={handleDelete}
              sx={{ 
                width: 20, 
                height: 20,
                color: '#ef4444',
                '&:hover': {
                  backgroundColor: '#ef4444',
                  color: 'white'
                }
              }}
            >
              <DeleteIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    );
  };
  
  // Render category chip
  const renderCategoryChip = () => (
    <Chip
      label={safeConfig.category}
      size="small"
      sx={{
        backgroundColor: 'rgba(var(--node-color-rgb), 0.1)',
        color: 'var(--node-color)',
        fontSize: '10px',
        height: 18,
        fontWeight: 500,
        border: '1px solid rgba(var(--node-color-rgb), 0.2)'
      }}
    />
  );
  
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
  
  return (
    <Paper
      sx={nodeStyles}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      elevation={selected ? 4 : 1}
    >
      {/* Status Indicator */}
      {renderStatusIcon()}
      
      {/* Input Handles */}
      {renderInputHandles()}
      
      {/* Node Content */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        {renderHeader()}
        
        {/* Category Chip */}
        {renderCategoryChip()}
        
        {/* Custom Content */}
        {customContent}
        
        {/* Default Content */}
        {renderDefaultContent()}
        
        {/* Children */}
        {children}
        
        {/* Custom Footer */}
        {customFooter}
      </Box>
      
      {/* Output Handles */}
      {renderOutputHandles()}
    </Paper>
  );
};
