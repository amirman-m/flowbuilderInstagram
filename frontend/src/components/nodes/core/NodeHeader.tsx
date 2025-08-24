// Shared NodeHeader component for consistent node headers
import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { NodeConfiguration } from '../../../config/nodeConfiguration';
import { NodeStatusIndicator } from './NodeStatusIndicator';
import { NodeExecutionStatus } from '../../../types/nodes';

export interface NodeHeaderProps {
  config: NodeConfiguration;
  isSelected?: boolean;
  isExecuting?: boolean;
  status?: NodeExecutionStatus;
  statusMessage?: string;
  onHeaderClick?: () => void;
}

/**
 * Reusable NodeHeader component providing consistent styling and behavior
 * across all node types. Handles icon display, title, status indicator, and
 * interactive states.
 */
export const NodeHeader: React.FC<NodeHeaderProps> = ({
  config,
  isSelected = false,
  isExecuting = false,
  status = NodeExecutionStatus.PENDING,
  statusMessage,
  onHeaderClick
}) => {
  const IconComponent = config.icon;
  
  // Determine status based on execution state if not explicitly provided
  const currentStatus = isExecuting ? NodeExecutionStatus.RUNNING : status;

  return (
    <Box
      onClick={onHeaderClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: isExecuting ? 'action.hover' : 'transparent',
        cursor: onHeaderClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        '&:hover': onHeaderClick ? {
          backgroundColor: 'action.hover'
        } : {}
      }}
    >
      {/* Left side: Icon and Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
        {IconComponent && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              color: config.color,
              '& svg': {
                fontSize: '16px'
              }
            }}
          >
            <IconComponent />
          </Box>
        )}
        
        <Tooltip title={config.description} placement="top">
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontSize: '13px',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '140px'
            }}
          >
            {config.name}
          </Typography>
        </Tooltip>
      </Box>

      {/* Right side: Status Indicator */}
      <NodeStatusIndicator
        status={currentStatus}
        message={statusMessage}
        size="small"
      />
    </Box>
  );
};
