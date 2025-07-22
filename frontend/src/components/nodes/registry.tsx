// src/components/nodes/registry.tsx
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Paper, Box, Typography, IconButton, Chip } from '@mui/material';
import { 
  Delete as DeleteIcon,
  CheckCircle,
  Error,
  Refresh,
  Schedule
} from '@mui/icons-material';
import { NodeInstance, FlowNode, NodeExecutionStatus } from '../../types/nodes';
import { ChatInputNode, OpenAIChatNode } from './node-types';
import { baseNodeStyles, getCategoryColor } from './styles';

// Import other node components

// Type for node component props
export interface NodeComponentProps {
  data: any;
  selected: boolean;
  id: string;
}

// Extended node data type with handlers
export interface NodeDataWithHandlers {
  nodeType: any;
  instance: any;
  selected?: boolean;
  executing?: boolean;
  errors?: string[];
  onNodeDelete?: (nodeId: string) => void;
  onNodeUpdate?: (nodeId: string, updates: any) => void;
}

// Helper function to get status icon
const getStatusIcon = (status: NodeExecutionStatus | undefined) => {
  switch (status) {
    case NodeExecutionStatus.SUCCESS:
      return <CheckCircle color="success" fontSize="small" />;
    case NodeExecutionStatus.ERROR:
      return <Error color="error" fontSize="small" />;
    case NodeExecutionStatus.RUNNING:
      return <Refresh color="primary" fontSize="small" />;
    case NodeExecutionStatus.PENDING:
      return <Schedule color="action" fontSize="small" />;
    default:
      return null;
  }
};

// Registry mapping node type IDs to components
// To add a new node type:
// 1. Create your node component in ./node-types/
// 2. Import it above
// 3. Add it to this registry
export const nodeComponentRegistry: Record<string, React.FC<NodeComponentProps>> = {
  'chat-input': ChatInputNode,
  'simple-openai-chat': OpenAIChatNode,
  // Add more node types here - Example:
  // 'instagram-trigger': InstagramTriggerNode,
  // 'auto-reply': AutoReplyNode,
};

// Default/fallback node component
export const DefaultNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
  const nodeData = data as FlowNode['data'];
  const { nodeType, instance } = nodeData;
  const categoryColor = getCategoryColor(nodeType.category);
  // Ensure instance is properly typed as NodeInstance
  const typedInstance = instance as NodeInstance;
  const statusIcon = getStatusIcon(typedInstance.data.lastExecution?.status);

  return (
    <Paper
      sx={{
        ...baseNodeStyles,
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
        <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
          {instance.label || nodeType.name}
        </Typography>
        {statusIcon && (
          <Box sx={{ ml: 1 }}>
            {statusIcon}
          </Box>
        )}
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

// Function to get the appropriate component for a node type
export const getNodeComponent = (nodeTypeId: string) => {
  return nodeComponentRegistry[nodeTypeId] || DefaultNode;
};