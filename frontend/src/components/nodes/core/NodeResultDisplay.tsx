// Node Result Display Component - Reusable component for displaying execution results
// Maintains consistent width and height constraints across all node types

import React from 'react';
import { Box, Typography } from '@mui/material';

interface NodeResultDisplayProps {
  title: string;
  content: string;
  nodeWidth?: number;
  maxHeightMultiplier?: number;
  backgroundColor?: string;
}

export const NodeResultDisplay: React.FC<NodeResultDisplayProps> = ({
  title,
  content,
  nodeWidth = 280,
  maxHeightMultiplier = 1.5,
  backgroundColor = '#f5f5f5'
}) => {
  const maxHeight = 60 * maxHeightMultiplier; // Base node height * multiplier

  return (
    <Box sx={{ 
      mt: 0.5, 
      py: 0.75, 
      px: 1, 
      backgroundColor, 
      borderRadius: 1,
      width: nodeWidth,
      maxWidth: nodeWidth,
      overflow: 'hidden'
    }}>
      <Typography variant="caption" sx={{ 
        color: '#666', 
        fontWeight: 600, 
        mb: 0.25, 
        display: 'block' 
      }}>
        {title}
      </Typography>
      <Box
        sx={{
          maxHeight: `${maxHeight}px`,
          overflowY: 'auto',
          p: 1,
          backgroundColor,
          width: '100%',
          boxSizing: 'border-box',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#c1c1c1',
            borderRadius: '3px',
            border: '1px solid #f1f1f1',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#a8a8a8',
          },
          // Firefox scrollbar styles
          scrollbarWidth: 'thin',
          scrollbarColor: '#c1c1c1 #f1f1f1',
        }}
      >
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block',
            color: '#333',
            fontSize: '0.8rem',
            lineHeight: 1.25,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap'
          }}
        >
          {content}
        </Typography>
      </Box>
    </Box>
  );
};
