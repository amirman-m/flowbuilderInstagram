// Shared NodeHeader component for consistent node headers
import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { NodeConfiguration } from '../../../config/nodeConfiguration';
import { NodeCategory } from '../../../types/nodes';

export interface NodeHeaderProps {
  config: NodeConfiguration;
  isSelected?: boolean;
  isExecuting?: boolean;
  onHeaderClick?: () => void;
}

/**
 * Reusable NodeHeader component providing consistent styling and behavior
 * across all node types. Handles icon display, title, category chip, and
 * interactive states.
 */
export const NodeHeader: React.FC<NodeHeaderProps> = ({
  config,
  isSelected = false,
  isExecuting = false,
  onHeaderClick
}) => {
  const IconComponent = config.icon;
  
  const getCategoryDisplayName = (category: NodeCategory): string => {
    switch (category) {
      case NodeCategory.TRIGGER:
        return 'Trigger';
      case NodeCategory.PROCESSOR:
        return 'Processor';
      case NodeCategory.ACTION:
        return 'Action';
      default:
        return 'Node';
    }
  };

  const getCategoryColor = (category: NodeCategory): string => {
    switch (category) {
      case NodeCategory.TRIGGER:
        return '#10b981'; // Green
      case NodeCategory.PROCESSOR:
        return '#3b82f6'; // Blue
      case NodeCategory.ACTION:
        return '#f59e0b'; // Orange
      default:
        return '#6b7280'; // Gray
    }
  };

  return (
    <Box
      onClick={onHeaderClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid',
        borderBottomColor: isSelected ? config.color : 'divider',
        backgroundColor: isExecuting ? 'action.hover' : 'transparent',
        cursor: onHeaderClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
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

      {/* Right side: Category Chip */}
      <Chip
        label={getCategoryDisplayName(config.category)}
        size="small"
        sx={{
          height: '20px',
          fontSize: '10px',
          fontWeight: 600,
          backgroundColor: getCategoryColor(config.category),
          color: 'white',
          '& .MuiChip-label': {
            padding: '0 6px'
          }
        }}
      />
    </Box>
  );
};
