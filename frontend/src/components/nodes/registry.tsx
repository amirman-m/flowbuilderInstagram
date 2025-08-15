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
import { ChatInputNode, VoiceInputNode, OpenAIChatNode, DeepSeekChatNode } from './types';
import { TranscriptionNode } from './types/TranscriptionNode';
import { TelegramInputNode } from './types/TelegramInputNode';
import { TelegramMessageActionNode } from './types/TelegramMessageActionNode';
import { getCategoryColor } from '../../styles/nodeTheme';

// Import other node components

// Type for node component props
export interface NodeComponentProps {
  data: NodeData;
  selected: boolean;
  id: string;
}

// Node data interface
export interface NodeData {
  nodeType: NodeType;
  instance: NodeInstance;
  flowId?: string;
  selected?: boolean;
  executing?: boolean;
  errors?: string[];
  executionResult?: NodeExecutionResult;
  // Additional properties for specific node types
  onNodeDelete?: (nodeId: string) => void;
  onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void;
  onExecute?: (nodeId: string, executionData?: Record<string, unknown>) => Promise<void>;
  onExecutionComplete?: (nodeId: string, result: NodeExecutionResult) => void;
}

// Node execution result interface (simplified version of the one in nodes.ts)
export interface NodeExecutionResult {
  status: NodeExecutionStatus;
  outputs: Record<string, unknown>;
  error?: string;
  startedAt: Date | string;
  completedAt?: Date | string;
  metadata?: Record<string, unknown>;
  success?: boolean;
  timestamp?: string;
}

// Extended node data type with handlers
export interface NodeDataWithHandlers extends NodeData {
  onDelete?: (nodeId: string) => void; // Alias for onNodeDelete for backward compatibility
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
  'chat_input': ChatInputNode,
  'voice_input': VoiceInputNode,
  'telegram_input': TelegramInputNode,
  'simple-openai-chat': OpenAIChatNode,
  'simple-deepseek-chat': DeepSeekChatNode,
  'transcription': TranscriptionNode,
  'send_telegram_message': TelegramMessageActionNode,
  // Add more node types here - Example:
  // 'instagram-trigger': InstagramTriggerNode,
  // 'auto-reply': AutoReplyNode,
};

// Default/fallback node component
export const DefaultNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
  const nodeType = data?.nodeType;
  const instance = data?.instance;

  // Fallback values when nodeType is unavailable (e.g., node types not loaded yet)
  const safeNodeType: NodeType = nodeType ?? {
    id: 'unknown',
    name: 'Unknown',
    description: 'Unknown node type',
    category: NodeCategory.PROCESSOR,
    version: '0.0.0',
    ports: { inputs: [], outputs: [] },
    settingsSchema: { type: 'object', properties: {} },
  };

  const categoryColor = getCategoryColor(safeNodeType.category);
  const statusIcon = instance?.data?.lastExecution ? getStatusIcon(instance.data.lastExecution?.status) : null;

  return (
    <Paper
      sx={{
        position: 'relative',
        padding: 2,
        minWidth: 200,
        minHeight: 80,
        border: '2px solid',
        borderRadius: 2,
        cursor: 'pointer',
        userSelect: 'none',
        borderColor: selected ? categoryColor : `${categoryColor}80`,
        borderWidth: selected ? 3 : 2,
        backgroundColor: selected ? `${categoryColor}10` : 'white'
      }}
    >
      {/* Input Handles */}
      {safeNodeType.ports.inputs.map((port: { id: string; name: string; required?: boolean; description?: string }, index: number) => (
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
            const onNodeDelete = data?.onNodeDelete;
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
      {safeNodeType.ports.outputs.map((port: { id: string; name: string; description?: string }, index: number) => (
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