import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { 
  Box, 
  Paper, 
  Typography, 
  Chip, 
  IconButton, 
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  PlayArrow as ExecuteIcon,
  Settings as SettingsIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Schedule as PendingIcon,
  Stop as RunningIcon
} from '@mui/icons-material';
import { NodeInstance, NodeExecutionStatus, NodeCategory } from '../../types/nodes';

// ============================================================================
// TYPES
// ============================================================================

interface NodeRendererProps extends NodeProps {
  data: NodeInstance['data'] & {
    nodeType: {
      name: string;
      category: NodeCategory;
      icon?: string;
      color?: string;
      ports: {
        inputs: Array<{ id: string; name: string; label: string; required: boolean }>;
        outputs: Array<{ id: string; name: string; label: string }>;
      };
    };
    onExecute?: () => void;
    onConfigure?: () => void;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getCategoryColor = (category: NodeCategory, theme: any) => {
  switch (category) {
    case NodeCategory.TRIGGER:
      return theme.palette.success.main;
    case NodeCategory.PROCESSOR:
      return theme.palette.primary.main;
    case NodeCategory.ACTION:
      return theme.palette.warning.main;
    default:
      return theme.palette.grey[500];
  }
};

const getExecutionStatusIcon = (status?: NodeExecutionStatus) => {
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

const getExecutionStatusColor = (theme: any, status?: NodeExecutionStatus) => {
  switch (status) {
    case NodeExecutionStatus.SUCCESS:
      return theme.palette.success.light;
    case NodeExecutionStatus.ERROR:
      return theme.palette.error.light;
    case NodeExecutionStatus.RUNNING:
      return theme.palette.primary.light;
    case NodeExecutionStatus.PENDING:
      return theme.palette.warning.light;
    default:
      return 'transparent';
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

const NodeRenderer: React.FC<NodeRendererProps> = memo(({ data, selected }) => {
  const theme = useTheme();
  const { nodeType, lastExecution, disabled, onExecute, onConfigure } = data;
  
  const categoryColor = getCategoryColor(nodeType.category, theme);
  const executionStatus = lastExecution?.status;
  const statusIcon = getExecutionStatusIcon(executionStatus);
  const statusColor = getExecutionStatusColor(theme, executionStatus);

  return (
    <Paper
      elevation={selected ? 8 : 2}
      sx={{
        minWidth: 200,
        maxWidth: 300,
        border: selected ? `2px solid ${categoryColor}` : `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        overflow: 'hidden',
        opacity: disabled ? 0.6 : 1,
        backgroundColor: statusColor !== 'transparent' ? alpha(statusColor, 0.1) : 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          elevation: 4,
          transform: 'translateY(-1px)'
        }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          backgroundColor: categoryColor,
          color: 'white',
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {nodeType.icon && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {/* Icon would be rendered here based on nodeType.icon */}
            </Box>
          )}
          <Typography variant="subtitle2" fontWeight="bold" noWrap>
            {nodeType.name}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {statusIcon}
          <Chip
            label={nodeType.category}
            size="small"
            sx={{
              backgroundColor: alpha(theme.palette.common.white, 0.2),
              color: 'white',
              fontSize: '0.7rem',
              height: 20
            }}
          />
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {data.settings?.description || 'No description'}
        </Typography>

        {/* Execution Status */}
        {lastExecution && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Last execution: {lastExecution.status}
            </Typography>
            {lastExecution.error && (
              <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                Error: {lastExecution.error}
              </Typography>
            )}
          </Box>
        )}

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
          {onConfigure && (
            <Tooltip title="Configure Node">
              <IconButton size="small" onClick={onConfigure}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onExecute && (
            <Tooltip title="Execute Node">
              <IconButton 
                size="small" 
                onClick={onExecute}
                disabled={disabled || executionStatus === NodeExecutionStatus.RUNNING}
              >
                <ExecuteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Input Handles */}
      {nodeType.ports.inputs.map((input, index) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Left}
          id={input.id}
          style={{
            top: `${((index + 1) * 100) / (nodeType.ports.inputs.length + 1)}%`,
            backgroundColor: input.required ? theme.palette.error.main : theme.palette.grey[400],
            border: `2px solid ${theme.palette.background.paper}`,
            width: 12,
            height: 12
          }}
        />
      ))}

      {/* Output Handles */}
      {nodeType.ports.outputs.map((output, index) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Right}
          id={output.id}
          style={{
            top: `${((index + 1) * 100) / (nodeType.ports.outputs.length + 1)}%`,
            backgroundColor: categoryColor,
            border: `2px solid ${theme.palette.background.paper}`,
            width: 12,
            height: 12
          }}
        />
      ))}
    </Paper>
  );
});

NodeRenderer.displayName = 'NodeRenderer';

export default NodeRenderer;
