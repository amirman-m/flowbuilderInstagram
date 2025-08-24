import React from 'react';
import { Box, Typography, IconButton, CircularProgress, Tooltip } from '@mui/material';
import { Handle, Position } from '@xyflow/react';
import { 
  PlayArrow as ExecuteIcon, 
  Refresh as RefreshIcon, 
  Settings as SettingsIcon, 
  Delete as DeleteIcon 
} from '@mui/icons-material';
import { NodePresentationData } from './NodePresenter';
import { NodeExecutionStatus, NodeCategory } from '../../../types/nodes';
import { createHandleStyles } from '../../../styles/nodeTheme';
import { NODE_ICONS } from '../../../config/nodeIcons';

interface BaseNodePresentationProps {
  presentationData: NodePresentationData;
  children?: React.ReactNode;
  customHeader?: React.ReactNode;
  customContent?: React.ReactNode;
  customFooter?: React.ReactNode;
  hideDefaultContent?: boolean;
  onSettingsClick?: () => void;
  
  // Port rendering data
  inputPorts: Array<{
    id: string;
    name: string;
    label?: string;
    description?: string;
    required?: boolean;
  }>;
  outputPorts: Array<{
    id: string;
    name: string;
    label?: string;
    description?: string;
    required?: boolean;
  }>;
  nodeTypeId?: string;
}

const BaseNodePresentation: React.FC<BaseNodePresentationProps> = ({
  presentationData,
  children,
  customHeader,
  customContent,
  customFooter,
  hideDefaultContent = false,
  onSettingsClick,
  inputPorts,
  outputPorts,
  nodeTypeId
}) => {
  const {
    isHovered,
    isExecuting,
    showSuccessAnimation,
    selected,
    executionStatus,
    statusMessage,
    executionData,
    safeConfig,
    gradient,
    handleExecute,
    handleRefresh,
    handleDelete,
    handleHover
  } = presentationData;

  // Status indicator component
  const renderStatusIndicator = () => {
    if (executionStatus === NodeExecutionStatus.PENDING) return null;

    const getStatusConfig = () => {
      switch (executionStatus) {
        case NodeExecutionStatus.RUNNING:
          return { color: '#f59e0b', icon: <CircularProgress size={8} sx={{ color: 'inherit' }} /> };
        case NodeExecutionStatus.SUCCESS:
          return { color: '#10b981', icon: '✓' };
        case NodeExecutionStatus.ERROR:
          return { color: '#ef4444', icon: '✗' };
        case NodeExecutionStatus.SKIPPED:
          return { color: '#6b7280', icon: '○' };
        default:
          return { color: '#6b7280', icon: '○' };
      }
    };

    const config = getStatusConfig();
    
    return (
      <Box
        sx={{
          position: 'absolute',
          top: -6,
          left: -6,
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: config.color,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '8px',
          fontWeight: 'bold',
          zIndex: 10,
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          border: '2px solid white'
        }}
      >
        {config.icon}
      </Box>
    );
  };

  // Input handles renderer
  const renderInputHandles = () => {
    return inputPorts.map((port, index) => {
      const isRequired = port.required || false;
      const nodeConfig = {
        id: safeConfig.name,
        category: NodeCategory.PROCESSOR,
        subcategory: 'general',
        name: safeConfig.name,
        description: safeConfig.description,
        icon: NODE_ICONS['default'],
        color: '#757575',
        componentName: 'BaseNode',
        features: {
          hasSettings: false,
          hasExecution: false,
          hasCustomUI: false,
          hasStatusIndicator: false
        }
      };
      const handleStyles = createHandleStyles(nodeConfig, isRequired);
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
              backgroundColor: 'rgba(59, 130, 246, 0.9)',
              padding: '1px 4px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              marginRight: '2px'
            }}
          >
            {port.label || port.name}
          </Typography>
        </Box>
      );
    });
  };

  // Output handles renderer
  const renderOutputHandles = () => {
    return outputPorts.map((port, index) => {
      const isRequired = port.required || false;
      const nodeConfig = {
        id: safeConfig.name,
        category: NodeCategory.PROCESSOR,
        subcategory: 'general',
        name: safeConfig.name,
        description: safeConfig.description,
        icon: NODE_ICONS['default'],
        color: '#757575',
        componentName: 'BaseNode',
        features: {
          hasSettings: false,
          hasExecution: false,
          hasCustomUI: false,
          hasStatusIndicator: false
        }
      };
      const handleStyles = createHandleStyles(nodeConfig, isRequired);
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
  };

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
      onMouseEnter={() => handleHover(true)}
      onMouseLeave={() => handleHover(false)}
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
                const IconComponent = NODE_ICONS[nodeTypeId || 'default'] || NODE_ICONS['default'];
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
              <IconButton
                size="small"
                onClick={handleExecute}
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
              
              <IconButton
                size="small"
                onClick={handleRefresh}
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
              
              {onSettingsClick && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSettingsClick();
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
                  Last execution: {String(executionData.lastExecuted || 'Never')}
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
};

export default BaseNodePresentation;
