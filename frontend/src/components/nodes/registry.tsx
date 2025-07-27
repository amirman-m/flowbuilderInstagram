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
import { NodeInstance, NodeExecutionStatus, NodeType, NodeCategory } from '../../types/nodes';
import { ChatInputNode, VoiceInputNode, OpenAIChatNode, DeepSeekChatNode } from './node-types';
import { TranscriptionNode } from './node-types/TranscriptionNode';
import { TelegramNode } from './node-types/ActionTelegramNodeSelf';
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
  onDelete?: (nodeId: string) => void;
  onExecute?: (nodeId: string, data: any) => Promise<void>;
  executionResult?: any;
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
  'voice_input': VoiceInputNode,
  'simple-openai-chat': OpenAIChatNode,
  'simple-deepseek-chat': DeepSeekChatNode,
  'transcription': TranscriptionNode,
  'telegram-send-message-for-self': TelegramNode,
  // Add more node types here - Example:
  // 'instagram-trigger': InstagramTriggerNode,
  // 'auto-reply': AutoReplyNode,
};

// Default/fallback node component
export const DefaultNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
  const nodeData = data as any;
  const nodeType = nodeData?.nodeType as NodeType | undefined;
  const instance = nodeData?.instance as NodeInstance | undefined;

  // Fallback values when nodeType is unavailable (e.g., node types not loaded yet)
  const safeNodeType: NodeType = nodeType ?? {
    id: 'unknown',
    name: 'Unknown',
    description: 'Unknown node type',
    category: NodeCategory.PROCESSOR,
    version: '0.0.0',
    ports: { inputs: [], outputs: [] } as any,
    settingsSchema: { type: 'object', properties: {} },
  } as NodeType;

  const categoryColor = getCategoryColor(safeNodeType.category);
  const typedInstance = instance as NodeInstance | undefined;
  const statusIcon = typedInstance?.data?.lastExecution ? getStatusIcon(typedInstance.data.lastExecution?.status) : null;

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
      {safeNodeType.ports.inputs.map((port: any, index: number) => (
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
          {instance?.label || safeNodeType.name}
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
        label={safeNodeType.category}
        size="small"
        sx={{
          backgroundColor: `${categoryColor}20`,
          color: categoryColor,
          fontSize: '0.7rem',
          height: '20px'
        }}
      />

      {/* Output Handles */}
      {safeNodeType.ports.outputs.map((port: any, index: number) => (
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