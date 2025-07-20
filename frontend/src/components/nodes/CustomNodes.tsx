import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  PlayArrow as TriggerIcon,
  Code as ProcessorIcon,
  Settings as ActionIcon,
  MoreVert as MoreIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Schedule as PendingIcon,
  Refresh as RunningIcon,
  Delete as DeleteIcon,
  Message as MessageIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { NodeCategory, NodeExecutionStatus, NodeInstance } from '../../types/nodes';
import { FlowNode } from '../../types/nodes';

// Base styles for all custom nodes
const nodeStyles = {
  minWidth: 200,
  minHeight: 80,
  padding: 2,
  border: '2px solid',
  borderRadius: 2,
  backgroundColor: 'white',
  cursor: 'pointer',
  '&:hover': {
    boxShadow: 3
  }
};

// Category colors
const getCategoryColor = (category: NodeCategory) => {
  switch (category) {
    case NodeCategory.TRIGGER:
      return '#4CAF50'; // Green
    case NodeCategory.PROCESSOR:
      return '#2196F3'; // Blue
    case NodeCategory.ACTION:
      return '#FF9800'; // Orange
    default:
      return '#757575'; // Grey
  }
};

// Get icon based on node type or category
const getNodeIcon = (nodeType: any) => {
  // Check if node has a specific icon defined
  if (nodeType.icon) {
    switch (nodeType.icon) {
      case 'message':
        return <MessageIcon />;
      case 'instagram':
        return <TriggerIcon />;
      case 'reply':
        return <ActionIcon />;
      default:
        return getCategoryIcon(nodeType.category);
    }
  }
  return getCategoryIcon(nodeType.category);
};

// Category icons (fallback)
const getCategoryIcon = (category: NodeCategory) => {
  switch (category) {
    case NodeCategory.TRIGGER:
      return <TriggerIcon />;
    case NodeCategory.PROCESSOR:
      return <ProcessorIcon />;
    case NodeCategory.ACTION:
      return <ActionIcon />;
    default:
      return <MoreIcon />;
  }
};

// Execution status icons
const getStatusIcon = (status?: NodeExecutionStatus) => {
  switch (status) {
    case NodeExecutionStatus.SUCCESS:
      return <SuccessIcon color="success" fontSize="small" />;
    case NodeExecutionStatus.ERROR:
      return <ErrorIcon color="error" fontSize="small" />;
    case NodeExecutionStatus.RUNNING:
      return <RunningIcon color="primary" fontSize="small" />;
    case NodeExecutionStatus.PENDING:
      return <PendingIcon color="action" fontSize="small" />;
    default:
      return null;
  }
};

// Base Custom Node Component
const BaseCustomNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  const nodeData = data as FlowNode['data'];
  const { nodeType, instance } = nodeData;
  const categoryColor = getCategoryColor(nodeType.category);
  // Ensure instance is properly typed as NodeInstance
  const typedInstance = instance as NodeInstance;
  const statusIcon = getStatusIcon(typedInstance.data.lastExecution?.status);

  return (
    <Paper
      sx={{
        ...nodeStyles,
        borderColor: selected ? categoryColor : `${categoryColor}80`,
        borderWidth: selected ? 3 : 2,
        backgroundColor: selected ? `${categoryColor}10` : 'white'
      }}
    >
      {/* Input Handles */}
      {nodeType.ports.inputs.map((port: any, index: number) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{
            top: `${20 + (index * 20)}px`,
            backgroundColor: port.required ? categoryColor : '#999'
          }}
        />
      ))}

      {/* Node Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Box sx={{ color: categoryColor, mr: 1 }}>
          {getNodeIcon(nodeType)}
        </Box>
        <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
          {instance.label || nodeType.name}
        </Typography>
        {statusIcon && (
          <Box sx={{ ml: 1 }}>
            {statusIcon}
          </Box>
        )}
        <Tooltip title="Node Settings">
          <IconButton size="small" sx={{ ml: 1 }}>
            <MoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {/* Chat Input Execution Button */}
        {nodeType.id === 'chat-input' && (
          <Tooltip title="Execute Chat Input">
            <IconButton 
              size="small" 
              sx={{ ml: 0.5 }}
              onClick={(event) => {
                event.stopPropagation();
                const onChatInputExecution = (data as any)?.onChatInputExecution;
                if (onChatInputExecution && id) {
                  onChatInputExecution(id);
                }
              }}
            >
              <SendIcon fontSize="small" color="primary" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Delete Node">
          <IconButton 
            size="small" 
            sx={{ ml: 0.5 }}
            onClick={(event) => {
              event.stopPropagation();
              const onNodeDelete = (data as any)?.onNodeDelete;
              if (onNodeDelete && id) {
                onNodeDelete(id);
              }
            }}
          >
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Node Category */}
      <Chip
        label={nodeType.category}
        size="small"
        sx={{
          backgroundColor: `${categoryColor}20`,
          color: categoryColor,
          fontSize: '0.7rem',
          height: '20px'
        }}
      />

      {/* Error indicator */}
      {nodeData.errors && nodeData.errors.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Chip
            label={`${nodeData.errors.length} error(s)`}
            size="small"
            color="error"
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: '20px' }}
          />
        </Box>
      )}

      {/* Output Handles */}
      {nodeType.ports.outputs.map((port: any, index: number) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{
            top: `${20 + (index * 20)}px`,
            backgroundColor: categoryColor
          }}
        />
      ))}
    </Paper>
  );
};

// Trigger Node Component
export const TriggerNode: React.FC<NodeProps> = (props) => {
  return <BaseCustomNode {...props} />;
};

// Processor Node Component
export const ProcessorNode: React.FC<NodeProps> = (props) => {
  return <BaseCustomNode {...props} />;
};

// Action Node Component
export const ActionNode: React.FC<NodeProps> = (props) => {
  return <BaseCustomNode {...props} />;
};

// Node types mapping for React Flow
export const nodeTypes = {
  customNode: BaseCustomNode, // Use 'customNode' to match FlowBuilder.tsx
  // Keep the category-based mapping for backward compatibility if needed
  [NodeCategory.TRIGGER]: TriggerNode,
  [NodeCategory.PROCESSOR]: ProcessorNode,
  [NodeCategory.ACTION]: ActionNode,
};

export default nodeTypes;
