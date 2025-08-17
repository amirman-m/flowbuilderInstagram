// BaseNode - Core shared functionality for all node components
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Tooltip,
  CircularProgress
} from '@mui/material';
import { 
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  PlayArrow as ExecuteIcon
} from '@mui/icons-material';

import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { NodeConfiguration, getNodeConfiguration } from '../../../config/nodeConfiguration';
import { createHandleStyles, getCategoryGradient } from '../../../styles/nodeTheme';
import { NODE_ICONS } from '../../../config/nodeIcons';
import { NodeCategory } from '../../../types/nodes';
import { useExecutionData } from '../hooks/useExecutionData';
import { NodeStatusIndicator } from './NodeStatusIndicator';
import { NodeExecutionStatus } from '../../../types/nodes';

// Extended props for BaseNode
export interface BaseNodeProps extends NodeComponentProps {
  nodeTypeId?: string;
  nodeConfig?: NodeConfiguration;
  children?: React.ReactNode;
  customContent?: React.ReactNode;
  onExecute?: () => Promise<void> | void;
  onSettings?: () => void;
  onSettingsClick?: () => void; // Alternative name for settings handler
  status?: NodeExecutionStatus;
  statusMessage?: string;
  isExecuting?: boolean; // External execution state
  hideDefaultContent?: boolean;
  customHeader?: React.ReactNode;
  customFooter?: React.ReactNode;
  icon?: React.ReactNode; // Custom icon for the node
}


export const BaseNode: React.FC<BaseNodeProps> = (props) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // Extract props
  const {
    id,
    data,
    selected = false,
    nodeTypeId,
    children,
    customContent,
    onExecute,
    onSettings,
    onSettingsClick,
    status = NodeExecutionStatus.PENDING,
    statusMessage,
    hideDefaultContent = false,
    customHeader,
    customFooter
  } = props;

  // Get node configuration
  const config = useMemo(() => nodeTypeId ? getNodeConfiguration(nodeTypeId) : undefined, [nodeTypeId]);
  
  // Extract node data
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeDelete } = nodeData;
  
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
  const currentExecutionStatus = executionData.status || 'pending';
  
  // Watch for successful execution to trigger animation
  useEffect(() => {
    if (currentExecutionStatus === 'success' && !showSuccessAnimation) {
      setShowSuccessAnimation(true);
      // Reset animation after 2 seconds
      const timer = setTimeout(() => {
        setShowSuccessAnimation(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentExecutionStatus, showSuccessAnimation]);
  
  // Handle delete action
  const handleDelete = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (onNodeDelete && id) {
      onNodeDelete(id);
    }
  }, [onNodeDelete, id]);
  
  
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
  
  // Render status indicator using new NodeStatusIndicator component
  const renderStatusIndicator = () => {
    if (!safeConfig.features.hasStatusIndicator) return null;
    
    // Determine current status - prioritize isExecuting state
    const currentStatus = isExecuting ? NodeExecutionStatus.RUNNING : status;
    
    return (
      <NodeStatusIndicator
        status={currentStatus}
        message={statusMessage}
        size="small"
      />
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
        <Box key={port.id} sx={{ position: 'absolute', left: 0, top: topPosition, display: 'flex', alignItems: 'center' }}>
          {/* Port Label - Only visible on hover */}
          <Typography 
            sx={{
              position: 'absolute',
              left: '-4px',
              top: '0px',
              transform: 'translate(-100%, -50%)',
              fontSize: '10px',
              fontWeight: 600,
              color: 'white',
              opacity: isHovered ? 1 : 0,
              transition: 'all 0.2s ease',
              pointerEvents: 'none',
              backgroundColor: 'rgba(147, 51, 234, 0.9)',
              padding: '1px 4px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              marginRight: '2px'
            }}
          >
            {port.label || port.name}
          </Typography>
          
          <Handle
            type="target"
            position={Position.Left}
            id={port.id}
            style={cleanStyles}
          >
            <Tooltip 
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '12px' }}>
                    {String(port.label || port.name)}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', opacity: 0.8 }}>
                    {String(port.description || '')}
                  </Typography>
                  <Typography sx={{ fontSize: '10px', opacity: 0.6, mt: 0.5 }}>
                    ID: {port.id} • {isRequired ? 'Required' : 'Optional'}
                  </Typography>
                </Box>
              } 
              placement="left"
              arrow
            >
              <Box />
            </Tooltip>
          </Handle>
        </Box>
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
        <Box key={port.id} sx={{ position: 'absolute', right: 0, top: topPosition, display: 'flex', alignItems: 'center' }}>
          <Handle
            type="source"
            position={Position.Right}
            id={port.id}
            style={cleanStyles}
          >
            <Tooltip 
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '12px' }}>
                    {String(port.label || port.name)}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', opacity: 0.8 }}>
                    {String(port.description || '')}
                  </Typography>
                  <Typography sx={{ fontSize: '10px', opacity: 0.6, mt: 0.5 }}>
                    ID: {port.id} • {isRequired ? 'Required' : 'Optional'}
                  </Typography>
                </Box>
              } 
              placement="right"
              arrow
            >
              <Box />
            </Tooltip>
          </Handle>
          
          {/* Port Label - Only visible on hover */}
          <Typography 
            sx={{
              position: 'absolute',
              right: '-4px',
              top: '0px',
              transform: 'translate(100%, -50%)',
              fontSize: '10px',
              fontWeight: 600,
              color: 'white',
              opacity: isHovered ? 1 : 0,
              transition: 'all 0.2s ease',
              pointerEvents: 'none',
              backgroundColor: 'rgba(16, 185, 129, 0.9)',
              padding: '1px 4px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              marginLeft: '2px'
            }}
          >
            {port.label || port.name}
          </Typography>
        </Box>
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
          </Box>
        </Box>
        
        {/* Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Status Indicator */}
          {renderStatusIndicator()}
          
          {/* Settings Button */}
          {safeConfig.features.hasSettings && (onSettings || onSettingsClick) && (
            <IconButton
              size="small"
              onClick={onSettings || onSettingsClick}
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
    <Box
      sx={{
        position: 'relative',
        width: 280,
        height: 160,
        minWidth: 280,
        minHeight: 160,
        maxWidth: 280,
        maxHeight: 160,
        borderRadius: '12px',
        background: 'transparent',
        border: showSuccessAnimation
          ? '2px solid #10b981'
          : selected 
            ? `2px solid ${gradient.primary}` 
            : `1px solid rgba(0, 0, 0, 0.15)`,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.15s ease-out',
        boxShadow: showSuccessAnimation
          ? '0 8px 32px rgba(16, 185, 129, 0.3), 0 0 0 3px rgba(16, 185, 129, 0.1)'
          : isHovered 
            ? `0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px ${gradient.primary}20`
            : '0 2px 8px rgba(0, 0, 0, 0.04)',
        transform: isHovered ? 'translateY(-2px) scale(1.02)' : 'translateY(0px) scale(1)',
        '&:hover': {
          borderColor: `${gradient.primary}`,
          borderWidth: '2px',
          backgroundColor: 'rgba(255, 255, 255, 1)',
          '& .node-ports': {
            opacity: 1
          },
          '& .port-label': {
            opacity: 1,
            transform: 'translateX(0)'
          }
        },
        '&:active': {
          transform: 'translateY(0px) scale(1.05)',
          transition: 'all 0.1s ease-out'
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status Indicator */}
      {renderStatusIndicator()}
      
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
        padding: '16px'
      }}>
        {/* Logo and Title Section */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: 1.5, 
          mb: 2 
        }}>
          {/* Node Icon */}
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: gradient.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)'
            }}
          >
            {(() => {
              const IconComponent = NODE_ICONS[nodeType?.id || 'default'] || NODE_ICONS['default'];
              return <IconComponent sx={{ fontSize: 14 }} />;
            })()}
          </Box>
          
          {/* Title */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 600,
                fontSize: '14px',
                lineHeight: 1.2,
                color: '#1a1a1a',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
              }}
            >
              {safeConfig.name}
            </Typography>
          </Box>
          
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 0.5, opacity: isHovered ? 1 : 0, transition: 'opacity 0.2s ease' }}>
            {onExecute && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExecute(e);
                }}
                disabled={isExecuting}
                sx={{
                  width: 20,
                  height: 20,
                  color: 'rgba(34, 197, 94, 0.8)',
                  '&:hover': {
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    color: 'rgba(34, 197, 94, 1)'
                  },
                  '&:disabled': {
                    opacity: 0.5
                  }
                }}
              >
                {isExecuting ? (
                  <CircularProgress size={12} sx={{ color: 'inherit' }} />
                ) : (
                  <ExecuteIcon sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            )}
            {(onSettings || onSettingsClick) && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSettings) onSettings();
                  if (onSettingsClick) onSettingsClick();
                }}
                sx={{
                  width: 20,
                  height: 20,
                  color: 'rgba(0, 0, 0, 0.5)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    color: 'rgba(0, 0, 0, 0.7)'
                  }
                }}
              >
                <SettingsIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={handleDelete}
              sx={{
                width: 20,
                height: 20,
                color: 'rgba(0, 0, 0, 0.5)',
                '&:hover': {
                  backgroundColor: 'rgba(244, 67, 54, 0.04)',
                  color: '#f44336'
                }
              }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Box>
        
        {/* Custom Content */}
        {customContent}
        
        {/* Default Content */}
        <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {!hideDefaultContent && (
            <Box sx={{ mt: 1 }}>
              {/* Description */}
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#4a4a4a',
                  fontSize: '12px',
                  lineHeight: 1.4,
                  display: 'block',
                  fontWeight: 500
                }}
              >
                {safeConfig.description}
              </Typography>
              
              {/* Execution Status */}
              {executionData.hasFreshResults && (
                <Box sx={{ mt: 1 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#16a34a',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    ✓ Last executed: {new Date(executionData.lastExecuted || '').toLocaleTimeString()}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          {children}
        </Box>
        
        {/* Custom Footer */}
        {customFooter}
      </Box>
      
      {/* Output Handles */}
      {renderOutputHandles()}
    </Box>
  );
};
