import React from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge
} from '@xyflow/react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { FlowEdge, NodeDataType } from '../../types/nodes';

// Data type colors
const getDataTypeColor = (dataType?: NodeDataType) => {
  switch (dataType) {
    case NodeDataType.STRING:
      return '#4CAF50'; // Green
    case NodeDataType.NUMBER:
      return '#2196F3'; // Blue
    case NodeDataType.BOOLEAN:
      return '#FF9800'; // Orange
    case NodeDataType.OBJECT:
      return '#9C27B0'; // Purple
    case NodeDataType.ARRAY:
      return '#F44336'; // Red
    case NodeDataType.ANY:
      return '#607D8B'; // Blue Grey
    default:
      return '#757575'; // Grey
  }
};

interface CustomEdgeProps extends EdgeProps {
  onEdgeDelete?: (edgeId: string) => void;
}

export const CustomEdge: React.FC<CustomEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  selected
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as FlowEdge | undefined;
  const edgeColor = edgeData?.hasError 
    ? '#F44336' // Red for errors
    : edgeData?.dataType 
      ? getDataTypeColor(edgeData.dataType)
      : '#757575'; // Default grey

  const edgeStyle = {
    ...style,
    stroke: edgeColor,
    strokeWidth: selected ? 3 : 2,
    strokeDasharray: edgeData?.conditional ? '5,5' : 'none',
  };

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={edgeStyle}
      />
      
      {/* Edge Label */}
      <EdgeLabelRenderer>
        <Box
          sx={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}
          className="nodrag nopan"
        >
          {/* Data Type Indicator */}
          {edgeData?.dataType && (
            <Chip
              label={edgeData.dataType}
              size="small"
              sx={{
                backgroundColor: getDataTypeColor(edgeData.dataType),
                color: 'white',
                fontSize: '0.6rem',
                height: '16px',
                '& .MuiChip-label': {
                  px: 0.5
                }
              }}
            />
          )}

          {/* Conditional Indicator */}
          {edgeData?.conditional && (
            <Chip
              label="IF"
              size="small"
              variant="outlined"
              sx={{
                fontSize: '0.6rem',
                height: '16px',
                borderColor: edgeColor,
                color: edgeColor,
                '& .MuiChip-label': {
                  px: 0.5
                }
              }}
            />
          )}

          {/* Error Indicator */}
          {edgeData?.hasError && (
            <Tooltip title="Connection has validation errors">
              <ErrorIcon 
                sx={{ 
                  color: '#F44336', 
                  fontSize: '16px' 
                }} 
              />
            </Tooltip>
          )}

          {/* Delete Button (shown on hover/selection) */}
          {selected && (
            <Tooltip title="Delete Connection">
              <IconButton
                size="small"
                sx={{
                  width: 16,
                  height: 16,
                  backgroundColor: '#ff4d4f',
                  color: 'white',
                  border: '1px solid #ff4d4f',
                  '&:hover': {
                    backgroundColor: '#ff7875',
                    border: '1px solid #ff7875'
                  }
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  // Use React Flow's built-in edge deletion
                  const deleteEdge = (data as any)?.onEdgeDelete;
                  if (deleteEdge) {
                    deleteEdge(id);
                  } else {
                    console.log('Delete edge:', id);
                  }
                }}
              >
                <CloseIcon sx={{ fontSize: '10px' }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </EdgeLabelRenderer>
    </>
  );
};

// Edge types mapping for React Flow
export const edgeTypes = {
  custom: CustomEdge,
};

export default CustomEdge;
