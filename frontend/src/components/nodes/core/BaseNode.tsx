// BaseNode - Performance-optimized core shared functionality for all node components
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
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
  PlayArrow as ExecuteIcon,
  Refresh as RefreshIcon
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
  onRefresh?: () => Promise<void> | void;
  onSettings?: () => void;
  onSettingsClick?: () => void;
  status?: NodeExecutionStatus;
  statusMessage?: string;
  isExecuting?: boolean;
  hideDefaultContent?: boolean;
  customHeader?: React.ReactNode;
  customFooter?: React.ReactNode;
  icon?: React.ReactNode;
}

// Memoized BaseNode component for performance optimization
export const BaseNode: React.FC<BaseNodeProps> = memo((props) => {
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
    onRefresh,
    onSettings,
    onSettingsClick,
    status = NodeExecutionStatus.PENDING,
    statusMessage,
    hideDefaultContent = false,
    customHeader,
    customFooter
  } = props;

  // Get node configuration with memoization
  const config = useMemo(() => 
    nodeTypeId ? getNodeConfiguration(nodeTypeId) : undefined, 
    [nodeTypeId]
  );
  
  // Extract node data
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeDelete } = nodeData;
  
  // Use execution data hook for fresh results
  const executionData = useExecutionData(nodeData);
  
  // Fallback configuration with memoization
  const safeConfig: NodeConfiguration = useMemo(() => config || {
    id: nodeTypeId || 'unknown-node',
    category: NodeCategory.PROCESSOR,
    subcategory: 'Unknown',
    name: 'Unknown Node',
    description: 'Unknown node type',
    icon: () => null,
    color: '#757575',
    componentName: 'UnknownNode',
    features: {
      hasSettings: false,
      hasExecution: true,
      hasCustomUI: false,
      hasStatusIndicator: true
    }
  }, [config, nodeTypeId]);
  
  // Get gradient colors
  const gradient = useMemo(() => getCategoryGradient(safeConfig.category), [safeConfig.category]);
  
  // Determine current execution status
  const currentExecutionStatus = executionData.status || 'pending';
  
  // Watch for successful execution to trigger animation
  useEffect(() => {
    if (currentExecutionStatus === 'success' && !showSuccessAnimation) {
      setShowSuccessAnimation(true);
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
  
  // Handle refresh action
  const handleRefresh = useCallback(async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onRefresh) {
      try {
        await onRefresh();
      } catch (error) {
        console.error('Node refresh failed:', error);
      }
    }
  }, [onRefresh]);
  
  // Render status indicator
  const renderStatusIndicator = useCallback(() => {
    if (!safeConfig.features.hasStatusIndicator) return null;
    
    const currentStatus = isExecuting ? NodeExecutionStatus.RUNNING : status;
    
    return (
      <NodeStatusIndicator
        status={currentStatus}
        message={statusMessage}
        size="small"
      />
    );
  }, [safeConfig.features.hasStatusIndicator, isExecuting, status, statusMessage]);
  
  // Render input handles
  const renderInputHandles = useCallback(() => {
    if (!nodeType?.ports?.inputs) return null;
    
    return nodeType.ports.inputs.map((port: any, index: number) => {
      const isRequired = port.required || safeConfig.ports?.requiredInputs?.includes(port.id);
      const handleStyles = createHandleStyles(safeConfig, isRequired);
      const topPosition = `${30 + (index * 25)}px`;
      
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
  }, [nodeType?.ports?.inputs, safeConfig, isHovered]);
  
  // Render output handles
  const renderOutputHandles = useCallback(() => {
    if (!nodeType?.ports?.outputs) return null;
    
    return nodeType.ports.outputs.map((port: any, index: number) => {
      const isRequired = port.required || safeConfig.ports?.requiredOutputs?.includes(port.id);
      const handleStyles = createHandleStyles(safeConfig, isRequired);
      const topPosition = `${30 + (index * 25)}px`;
      
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
  }, [nodeType?.ports?.outputs, safeConfig, isHovered]);

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
        {/* Header */}
        {customHeader || (
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
                {instance?.label || safeConfig.name}
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
                    <ExecuteIcon sx={{ fontSize: 12 }} />
                  )}
                </IconButton>
              )}
              
              {onRefresh && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefresh(e);
                  }}
                  sx={{
                    width: 20,
                    height: 20,
                    color: 'rgba(99, 102, 241, 0.8)',
                    '&:hover': {
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      color: 'rgba(99, 102, 241, 1)'
                    }
                  }}
                >
                  <RefreshIcon sx={{ fontSize: 12 }} />
                </IconButton>
              )}
              
              {(onSettings || onSettingsClick) && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    (onSettings || onSettingsClick)?.();
                  }}
                  sx={{
                    width: 20,
                    height: 20,
                    color: 'rgba(99, 102, 241, 0.8)',
                    '&:hover': {
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      color: 'rgba(99, 102, 241, 1)'
                    }
                  }}
                >
                  <SettingsIcon sx={{ fontSize: 12 }} />
                </IconButton>
              )}
              
              <IconButton
                size="small"
                onClick={handleDelete}
                sx={{
                  width: 20,
                  height: 20,
                  color: 'rgba(239, 68, 68, 0.8)',
                  '&:hover': {
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'rgba(239, 68, 68, 1)'
                  }
                }}
              >
                <DeleteIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Box>
          </Box>
        )}
        
        {/* Custom Content */}
        {customContent}
        
        {/* Default Content */}
        {!hideDefaultContent && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
            {executionData.hasFreshResults && (
              <Box sx={{ 
                mt: 1, 
                p: 1, 
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                borderRadius: 1,
                border: '1px solid rgba(16, 185, 129, 0.1)'
              }}>
                <Typography variant="caption" sx={{ fontSize: '10px', color: '#64748b' }}>
                  Last execution: {executionData.lastExecuted || 'Never'}
                </Typography>
              </Box>
            )}
          </Box>
        )}
        
        {/* Children */}
        {children}
        
        {/* Custom Footer */}
        {customFooter}
      </Box>
      
      {/* Output Handles */}
      {renderOutputHandles()}
    </Box>
  );
});

BaseNode.displayName = 'BaseNode';
