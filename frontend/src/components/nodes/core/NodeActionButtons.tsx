// Shared NodeActionButtons component for consistent node actions
import React from 'react';
import { Box, IconButton, Tooltip, CircularProgress } from '@mui/material';
import {
  PlayArrow as ExecuteIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Stop as StopIcon
} from '@mui/icons-material';
import { NodeConfiguration } from '../../../config/nodeConfiguration';

export interface NodeActionButtonsProps {
  config: NodeConfiguration;
  isExecuting?: boolean;
  canExecute?: boolean;
  hasSettings?: boolean;
  onExecute?: () => void;
  onSettings?: () => void;
  onDelete?: () => void;
  onStop?: () => void;
  size?: 'small' | 'medium';
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Reusable NodeActionButtons component providing consistent action buttons
 * for node execution, settings, and deletion across all node types.
 */
export const NodeActionButtons: React.FC<NodeActionButtonsProps> = ({
  config,
  isExecuting = false,
  canExecute = true,
  hasSettings = true,
  onExecute,
  onSettings,
  onDelete,
  onStop,
  size = 'small',
  orientation = 'horizontal'
}) => {
  const buttonSize = size === 'small' ? 24 : 32;
  const iconSize = size === 'small' ? 16 : 20;
  
  const buttonStyle = {
    width: buttonSize,
    height: buttonSize,
    padding: 0,
    minWidth: 'unset',
    '& svg': {
      fontSize: iconSize
    }
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 4,
        right: 4,
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        gap: 0.5,
        backgroundColor: 'background.paper',
        borderRadius: 1,
        padding: 0.5,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        border: '1px solid',
        borderColor: 'divider',
        opacity: 0.8,
        transition: 'opacity 0.2s ease-in-out',
        '&:hover': {
          opacity: 1
        }
      }}
    >
      {/* Execute/Stop Button */}
      {config.features?.hasExecution && (
        <Tooltip 
          title={isExecuting ? 'Stop execution' : 'Execute node'} 
          placement="top"
        >
          <span>
            <IconButton
              onClick={isExecuting ? onStop : onExecute}
              disabled={!canExecute && !isExecuting}
              sx={{
                ...buttonStyle,
                color: isExecuting ? 'error.main' : 'primary.main',
                '&:hover': {
                  backgroundColor: isExecuting ? 'error.light' : 'primary.light',
                  color: 'white'
                },
                '&:disabled': {
                  color: 'text.disabled'
                }
              }}
            >
              {isExecuting ? (
                onStop ? <StopIcon /> : <CircularProgress size={iconSize} />
              ) : (
                <ExecuteIcon />
              )}
            </IconButton>
          </span>
        </Tooltip>
      )}

      {/* Settings Button */}
      {config.features?.hasSettings && hasSettings && (
        <Tooltip title="Node settings" placement="top">
          <IconButton
            onClick={onSettings}
            sx={{
              ...buttonStyle,
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
                color: 'text.primary'
              }
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* Delete Button */}
      <Tooltip title="Delete node" placement="top">
        <IconButton
          onClick={onDelete}
          sx={{
            ...buttonStyle,
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'error.light',
              color: 'error.contrastText'
            }
          }}
        >
          <DeleteIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
};
