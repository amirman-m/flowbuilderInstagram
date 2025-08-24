// EnhancedNodeStatusIndicator - Real-time status indicator using NodeExecutionManager
// Automatically updates without manual state management
// Follows Single Responsibility Principle: Only handles status visualization

import React from 'react';
import { Box, CircularProgress, Tooltip, Typography } from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  SkipNext
} from '@mui/icons-material';
import { NodeExecutionStatus } from '../../../types/nodes';
import { useNodeExecutionStatus } from '../hooks/useNodeExecutionStatus';

/**
 * Props for EnhancedNodeStatusIndicator
 */
export interface EnhancedNodeStatusIndicatorProps {
  /** Node ID to monitor */
  nodeId: string;
  
  /** Size of the indicator */
  size?: 'small' | 'medium' | 'large';
  
  /** Whether to show status message in tooltip */
  showTooltip?: boolean;
  
  /** Whether to show execution time */
  showExecutionTime?: boolean;
  
  /** Custom positioning */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  
  /** Custom styling */
  sx?: any;
}

/**
 * Enhanced status indicator that automatically updates via NodeExecutionManager
 * 
 * Features:
 * - Real-time status updates without manual state management
 * - Animated transitions between states
 * - Execution time display
 * - Tooltip with detailed information
 * - Multiple size and position options
 * 
 * @param props - Component props
 */
export const EnhancedNodeStatusIndicator: React.FC<EnhancedNodeStatusIndicatorProps> = ({
  nodeId,
  size = 'medium',
  showTooltip = true,
  showExecutionTime = false,
  position = 'top-right',
  sx = {}
}) => {
  // Get real-time execution status
  const {
    status,
    message,
    startedAt,
    completedAt,
    error,
    isExecuting
  } = useNodeExecutionStatus(nodeId);

  // Size configurations
  const sizeConfig = {
    small: { iconSize: 16, containerSize: 20 },
    medium: { iconSize: 20, containerSize: 24 },
    large: { iconSize: 24, containerSize: 28 }
  };

  const { iconSize, containerSize } = sizeConfig[size];

  // Position configurations
  const positionStyles = {
    'top-right': {
      position: 'absolute',
      top: 4,
      right: 4,
      zIndex: 10
    },
    'top-left': {
      position: 'absolute',
      top: 4,
      left: 4,
      zIndex: 10
    },
    'bottom-right': {
      position: 'absolute',
      bottom: 4,
      right: 4,
      zIndex: 10
    },
    'bottom-left': {
      position: 'absolute',
      bottom: 4,
      left: 4,
      zIndex: 10
    },
    'inline': {
      position: 'relative',
      display: 'inline-flex'
    }
  };

  // Get status icon and color
  const getStatusDisplay = () => {
    switch (status) {
      case NodeExecutionStatus.RUNNING:
        return {
          icon: <CircularProgress size={iconSize} sx={{ color: '#2196f3' }} />,
          color: '#2196f3',
          bgColor: 'rgba(33, 150, 243, 0.1)',
          borderColor: 'rgba(33, 150, 243, 0.3)'
        };
      
      case NodeExecutionStatus.SUCCESS:
        return {
          icon: <CheckCircle sx={{ fontSize: iconSize, color: '#4caf50' }} />,
          color: '#4caf50',
          bgColor: 'rgba(76, 175, 80, 0.1)',
          borderColor: 'rgba(76, 175, 80, 0.3)'
        };
      
      case NodeExecutionStatus.ERROR:
        return {
          icon: <ErrorIcon sx={{ fontSize: iconSize, color: '#f44336' }} />,
          color: '#f44336',
          bgColor: 'rgba(244, 67, 54, 0.1)',
          borderColor: 'rgba(244, 67, 54, 0.3)'
        };
      
      case NodeExecutionStatus.SKIPPED:
        return {
          icon: <SkipNext sx={{ fontSize: iconSize, color: '#ff9800' }} />,
          color: '#ff9800',
          bgColor: 'rgba(255, 152, 0, 0.1)',
          borderColor: 'rgba(255, 152, 0, 0.3)'
        };
      
      case NodeExecutionStatus.PENDING:
      default:
        return {
          icon: <Schedule sx={{ fontSize: iconSize, color: '#9e9e9e' }} />,
          color: '#9e9e9e',
          bgColor: 'rgba(158, 158, 158, 0.1)',
          borderColor: 'rgba(158, 158, 158, 0.3)'
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  // Calculate execution time
  const getExecutionTime = () => {
    if (!startedAt) return null;
    
    const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
    const end = completedAt 
      ? (completedAt instanceof Date ? completedAt : new Date(completedAt))
      : new Date();
    
    const diffMs = end.getTime() - start.getTime();
    
    if (diffMs < 1000) return `${diffMs}ms`;
    if (diffMs < 60000) return `${(diffMs / 1000).toFixed(1)}s`;
    return `${(diffMs / 60000).toFixed(1)}m`;
  };

  // Build tooltip content
  const getTooltipContent = () => {
    const executionTime = getExecutionTime();
    
    return (
      <Box sx={{ p: 0.5 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '12px', mb: 0.5 }}>
          Status: {status.charAt(0).toUpperCase() + status.slice(1)}
        </Typography>
        
        {message && (
          <Typography sx={{ fontSize: '11px', mb: 0.5, opacity: 0.9 }}>
            {message}
          </Typography>
        )}
        
        {error && (
          <Typography sx={{ fontSize: '11px', mb: 0.5, color: '#f44336' }}>
            Error: {error}
          </Typography>
        )}
        
        {showExecutionTime && executionTime && (
          <Typography sx={{ fontSize: '10px', opacity: 0.7 }}>
            {isExecuting ? 'Running for: ' : 'Completed in: '}{executionTime}
          </Typography>
        )}
        
        {startedAt && (
          <Typography sx={{ fontSize: '10px', opacity: 0.7, mt: 0.5 }}>
            Started: {new Date(startedAt).toLocaleTimeString()}
          </Typography>
        )}
      </Box>
    );
  };

  const indicator = (
    <Box
      sx={{
        ...positionStyles[position],
        width: containerSize,
        height: containerSize,
        borderRadius: '50%',
        backgroundColor: statusDisplay.bgColor,
        border: `1px solid ${statusDisplay.borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease-in-out',
        cursor: showTooltip ? 'help' : 'default',
        '&:hover': showTooltip ? {
          transform: 'scale(1.1)',
          backgroundColor: statusDisplay.bgColor,
          borderColor: statusDisplay.color
        } : {},
        ...sx
      }}
    >
      {statusDisplay.icon}
    </Box>
  );

  if (showTooltip) {
    return (
      <Tooltip
        title={getTooltipContent()}
        placement="top"
        arrow
        enterDelay={300}
        leaveDelay={100}
      >
        {indicator}
      </Tooltip>
    );
  }

  return indicator;
};

/**
 * Compact status indicator for use in lists or small spaces
 */
export const CompactNodeStatusIndicator: React.FC<{
  nodeId: string;
  showLabel?: boolean;
}> = ({ nodeId, showLabel = false }) => {
  const { status, isExecuting } = useNodeExecutionStatus(nodeId);

  const getStatusColor = () => {
    switch (status) {
      case NodeExecutionStatus.RUNNING: return '#2196f3';
      case NodeExecutionStatus.SUCCESS: return '#4caf50';
      case NodeExecutionStatus.ERROR: return '#f44336';
      case NodeExecutionStatus.SKIPPED: return '#ff9800';
      default: return '#9e9e9e';
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          animation: isExecuting ? 'pulse 1.5s ease-in-out infinite' : 'none',
          '@keyframes pulse': {
            '0%': { opacity: 1 },
            '50%': { opacity: 0.5 },
            '100%': { opacity: 1 }
          }
        }}
      />
      {showLabel && (
        <Typography sx={{ fontSize: '11px', color: getStatusColor() }}>
          {status}
        </Typography>
      )}
    </Box>
  );
};
