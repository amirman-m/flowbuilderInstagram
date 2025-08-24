// Shared NodeStatusIndicator component for execution status display
import React from 'react';
import { Box, Tooltip, CircularProgress } from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  RadioButtonUnchecked as IdleIcon
} from '@mui/icons-material';
import { NodeExecutionStatus } from '../../../types/nodes';

export interface NodeStatusIndicatorProps {
  status: NodeExecutionStatus;
  message?: string;
  executionTime?: number;
  lastExecuted?: string;
  error?: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Reusable NodeStatusIndicator component that displays execution status
 * with appropriate icons, colors, and animations.
 */
export const NodeStatusIndicator: React.FC<NodeStatusIndicatorProps> = ({
  status,
  message,
  executionTime,
  lastExecuted,
  error,
  size = 'medium'
}) => {
  const getStatusConfig = () => {
    switch (status) {
      // PENDING maps to neutral idle state (simple circle)
      case NodeExecutionStatus.PENDING:
        return {
          icon: IdleIcon,
          color: '#6b7280',
          tooltip: message || 'Ready to execute',
          animated: false
        };
      case NodeExecutionStatus.RUNNING:
        return {
          icon: CircularProgress,
          color: '#f59e0b',
          tooltip: message || 'Running...',
          animated: true
        };
      case NodeExecutionStatus.SUCCESS:
        return {
          icon: SuccessIcon,
          color: '#10b981',
          tooltip: message || `Executed successfully${executionTime ? ` in ${executionTime}ms` : ''}${lastExecuted ? ` at ${new Date(lastExecuted).toLocaleTimeString()}` : ''}`,
          animated: false
        };
      case NodeExecutionStatus.ERROR:
        return {
          icon: ErrorIcon,
          color: '#ef4444',
          tooltip: message || error || 'Execution failed',
          animated: false
        };
      // SKIPPED maps to the prior WARNING visual (yellow, settings not configured)
      case NodeExecutionStatus.SKIPPED:
        return {
          icon: WarningIcon,
          color: '#f59e0b',
          tooltip: message || 'Warning - Settings not configured',
          animated: false
        };
      default:
        return {
          icon: IdleIcon,
          color: '#6b7280',
          tooltip: 'Unknown status',
          animated: false
        };
    }
  };

  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return { iconSize: 14, containerSize: 18 };
      case 'large':
        return { iconSize: 24, containerSize: 28 };
      case 'medium':
      default:
        return { iconSize: 18, containerSize: 22 };
    }
  };

  const statusConfig = getStatusConfig();
  const sizeConfig = getSizeConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <Tooltip title={statusConfig.tooltip} placement="top">
      <Box
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: sizeConfig.containerSize,
          height: sizeConfig.containerSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          backgroundColor: 'background.paper',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: `1px solid ${statusConfig.color}`,
          color: statusConfig.color,
          zIndex: 10,
          transition: 'all 0.2s ease-in-out',
          animation: statusConfig.animated ? 'pulse 2s infinite' : 'none',
          '&:hover': {
            transform: 'scale(1.1)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
          },
          '@keyframes pulse': {
            '0%': {
              opacity: 1,
              transform: 'scale(1)'
            },
            '50%': {
              opacity: 0.7,
              transform: 'scale(1.05)'
            },
            '100%': {
              opacity: 1,
              transform: 'scale(1)'
            }
          }
        }}
      >
        {status === NodeExecutionStatus.RUNNING ? (
          <CircularProgress
            size={sizeConfig.iconSize}
            thickness={4}
            sx={{ color: statusConfig.color }}
          />
        ) : (
          <StatusIcon
            sx={{
              fontSize: sizeConfig.iconSize,
              color: statusConfig.color
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
};
