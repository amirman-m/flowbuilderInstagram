// Compact Modern Node Presentation Component
// SOLID-compliant UI component for modern, compact node rendering

import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { 
  PlayArrow as ExecuteIcon,
  Delete as DeleteIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Circle as StatusIcon
} from '@mui/icons-material';
import { Handle, Position } from '@xyflow/react';
import { NodeExecutionStatus } from '../../../types/nodes';
import { getNodeColor, generateColorVariables } from '../../../styles/modernNodePalette';

interface CompactNodePresentationProps {
  // Node identification
  nodeName: string;
  nodeIcon: React.ReactNode;
  colorName: string;
  
  // Execution state
  executionStatus: NodeExecutionStatus;
  isExecuting: boolean;
  
  // Event handlers
  onExecute: () => void;
  onDelete: () => void;
  
  // Port configuration from backend
  inputPorts?: Array<{id: string; name: string; label: string}>;
  outputPorts?: Array<{id: string; name: string; label: string}>;
  
  // Optional customization
  showExecuteButton?: boolean;
  showDeleteButton?: boolean;
  disabled?: boolean;
}

export const CompactNodePresentation: React.FC<CompactNodePresentationProps> = ({
  nodeName,
  nodeIcon,
  colorName,
  executionStatus,
  isExecuting,
  onExecute,
  onDelete,
  inputPorts = [],
  outputPorts = [],
  showExecuteButton = true,
  showDeleteButton = true,
  disabled = false
}) => {
  const nodeColor = getNodeColor(colorName);
  const colorVariables = generateColorVariables(colorName);

  // Status indicator configuration
  const getStatusConfig = () => {
    switch (executionStatus) {
      case NodeExecutionStatus.RUNNING:
        return { 
          color: '#f59e0b', 
          icon: <StatusIcon sx={{ fontSize: 8 }} />,
          tooltip: 'Running...',
          pulse: true 
        };
      case NodeExecutionStatus.SUCCESS:
        return { 
          color: '#10b981', 
          icon: <SuccessIcon sx={{ fontSize: 8 }} />,
          tooltip: 'Completed successfully',
          pulse: false 
        };
      case NodeExecutionStatus.ERROR:
        return { 
          color: '#ef4444', 
          icon: <ErrorIcon sx={{ fontSize: 8 }} />,
          tooltip: 'Execution failed',
          pulse: false 
        };
      case NodeExecutionStatus.SKIPPED:
        return { 
          color: '#6b7280', 
          icon: <WarningIcon sx={{ fontSize: 8 }} />,
          tooltip: 'Skipped',
          pulse: false 
        };
      default:
        return { 
          color: '#94a3b8', 
          icon: <StatusIcon sx={{ fontSize: 8 }} />,
          tooltip: 'Ready to execute',
          pulse: false 
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <Box
      sx={{
        position: 'relative',
        width: 280,
        height: 60,
        borderRadius: '12px',
        background: nodeColor.background,
        border: `2px solid ${nodeColor.border}`,
        boxShadow: `0 4px 12px ${nodeColor.shadow}`,
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        overflow: 'visible',
        zIndex: 1,
        ...colorVariables,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 6px 20px ${nodeColor.shadow}`,
        }
      }}
    >
      {/* Node Icon */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          backgroundColor: nodeColor.primary,
          borderRadius: '4px',
          color: nodeColor.text,
          fontSize: '14px',
          flexShrink: 0,
          marginRight: 1
        }}
      >
        {nodeIcon}
      </Box>

      {/* Node Name */}
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          fontSize: '13px',
          fontWeight: 500,
          color: '#1a1a1a',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginRight: 1
        }}
      >
        {nodeName}
      </Typography>

      {/* Action Buttons */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flexShrink: 0
        }}
      >
        {/* Execute Button */}
        {showExecuteButton && (
          <Tooltip title={isExecuting ? 'Executing...' : 'Execute node'}>
            <span>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onExecute();
                }}
                disabled={disabled || isExecuting}
                sx={{
                  width: 20,
                  height: 20,
                  backgroundColor: nodeColor.primary,
                  color: nodeColor.text,
                  '&:hover': {
                    backgroundColor: nodeColor.accent
                  },
                  '&:disabled': {
                    backgroundColor: '#e5e7eb',
                    color: '#9ca3af'
                  }
                }}
              >
                <ExecuteIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Delete Button */}
        {showDeleteButton && (
          <Tooltip title="Delete node">
            <span>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={disabled}
                sx={{
                  width: 20,
                  height: 20,
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  '&:hover': {
                    backgroundColor: '#ef4444',
                    color: '#ffffff'
                  },
                  '&:disabled': {
                    backgroundColor: '#e5e7eb',
                    color: '#9ca3af'
                  }
                }}
              >
                <DeleteIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Status Indicator */}
        <Tooltip title={statusConfig.tooltip}>
          <Box
            sx={{
              color: statusConfig.color,
              marginLeft: 0.5,
              display: 'flex',
              alignItems: 'center',
              animation: statusConfig.pulse ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': {
                  opacity: 1
                },
                '50%': {
                  opacity: 0.5
                }
              }
            }}
          >
            {statusConfig.icon}
          </Box>
        </Tooltip>
      </Box>

      {/* Dynamic Input Handles */}
      {inputPorts.map((port, index) => (
        <Handle
          key={`input-${port.id}`}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{
            left: -8,
            top: inputPorts.length === 1 ? '50%' : `${20 + (index * 60 / Math.max(1, inputPorts.length - 1))}%`,
            width: 12,
            height: 12,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            border: '2px solid white',
            borderRadius: '50%',
            zIndex: '9999 !important' as any,
            opacity: 1,
            visibility: 'visible',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.1)',
            position: 'absolute'
          }}
          className="react-flow__handle-left"
          isConnectable={true}
        />
      ))}
      
      {/* Dynamic Output Handles */}
      {outputPorts.map((port, index) => (
        <Handle
          key={`output-${port.id}`}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{
            right: -8,
            top: outputPorts.length === 1 ? '50%' : `${20 + (index * 60 / Math.max(1, outputPorts.length - 1))}%`,
            width: 12,
            height: 12,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: '2px solid white',
            borderRadius: '50%',
            zIndex: '9999 !important' as any,
            opacity: 1,
            visibility: 'visible',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.1)',
            position: 'absolute'
          }}
          className="react-flow__handle-right"
          isConnectable={true}
        />
      ))}

      {/* Execution Progress Bar (when running) */}
      {isExecuting && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: nodeColor.primary,
            opacity: 0.3,
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '30%',
              backgroundColor: nodeColor.primary,
              animation: 'progress 1.5s ease-in-out infinite'
            },
            '@keyframes progress': {
              '0%': {
                transform: 'translateX(-100%)'
              },
              '100%': {
                transform: 'translateX(400%)'
              }
            }
          }}
        />
      )}
    </Box>
  );
};
