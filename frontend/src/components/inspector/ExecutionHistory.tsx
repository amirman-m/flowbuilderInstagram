import React from 'react';
import {
  Box,
  Typography,
  Alert,
  Chip,
  Paper,
  Divider,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  Refresh as RunningIcon,
  ContentCopy as CopyIcon,
  PlayArrow as ExecuteIcon
} from '@mui/icons-material';
import { NodeInstance, NodeExecutionResult, NodeExecutionStatus } from '../../types/nodes';

interface ExecutionHistoryProps {
  /** Node instance */
  nodeInstance: NodeInstance;
  
  /** Last execution result */
  lastExecution?: NodeExecutionResult;
}

interface ExecutionStatusProps {
  status: NodeExecutionStatus;
  size?: 'small' | 'medium';
}

const ExecutionStatusChip: React.FC<ExecutionStatusProps> = ({ status, size = 'small' }) => {
  const getStatusConfig = (status: NodeExecutionStatus) => {
    switch (status) {
      case NodeExecutionStatus.SUCCESS:
        return {
          color: 'success' as const,
          icon: <SuccessIcon />,
          label: 'Success'
        };
      case NodeExecutionStatus.ERROR:
        return {
          color: 'error' as const,
          icon: <ErrorIcon />,
          label: 'Error'
        };
      case NodeExecutionStatus.RUNNING:
        return {
          color: 'primary' as const,
          icon: <RunningIcon />,
          label: 'Running'
        };
      case NodeExecutionStatus.PENDING:
        return {
          color: 'default' as const,
          icon: <PendingIcon />,
          label: 'Pending'
        };
      case NodeExecutionStatus.SKIPPED:
        return {
          color: 'default' as const,
          icon: <PendingIcon />,
          label: 'Skipped'
        };
      default:
        return {
          color: 'default' as const,
          icon: <PendingIcon />,
          label: 'Unknown'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      color={config.color}
      size={size}
      variant="outlined"
    />
  );
};

const formatDuration = (startedAt: Date, completedAt?: Date): string => {
  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const duration = end.getTime() - start.getTime();
  
  if (duration < 1000) {
    return `${duration}ms`;
  } else if (duration < 60000) {
    return `${(duration / 1000).toFixed(1)}s`;
  } else {
    return `${(duration / 60000).toFixed(1)}m`;
  }
};

const formatTimestamp = (date: Date): string => {
  return new Date(date).toLocaleString();
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
};

export const ExecutionHistory: React.FC<ExecutionHistoryProps> = ({
  nodeInstance,
  lastExecution
}) => {
  if (!lastExecution) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          This node hasn't been executed yet.
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Execute the flow or run this node individually to see execution history.
        </Typography>
      </Box>
    );
  }

  const isRunning = lastExecution.status === NodeExecutionStatus.RUNNING;
  const hasError = lastExecution.status === NodeExecutionStatus.ERROR;
  const duration = formatDuration(lastExecution.startedAt, lastExecution.completedAt);

  return (
    <Box>
      {/* Current Status */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            Latest Execution
          </Typography>
          <ExecutionStatusChip status={lastExecution.status} size="medium" />
        </Box>

        {isRunning && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Execution in progress...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {/* Execution Details */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Started At
            </Typography>
            <Typography variant="body2">
              {formatTimestamp(lastExecution.startedAt)}
            </Typography>
          </Box>
          
          {lastExecution.completedAt && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Completed At
              </Typography>
              <Typography variant="body2">
                {formatTimestamp(lastExecution.completedAt)}
              </Typography>
            </Box>
          )}
          
          <Box>
            <Typography variant="caption" color="text.secondary">
              Duration
            </Typography>
            <Typography variant="body2">
              {duration}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="caption" color="text.secondary">
              Status
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <ExecutionStatusChip status={lastExecution.status} />
            </Box>
          </Box>
        </Box>

        {/* Error Details */}
        {hasError && lastExecution.error && (
          <Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                Error Details
              </Typography>
              <Tooltip title="Copy error message">
                <IconButton 
                  size="small" 
                  onClick={() => copyToClipboard(lastExecution.error || '')}
                >
                  <CopyIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <Paper sx={{ p: 2, backgroundColor: '#ffebee' }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: 'error.main',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {lastExecution.error}
              </Typography>
            </Paper>
          </Box>
        )}

        {/* Metadata */}
        {lastExecution.metadata && Object.keys(lastExecution.metadata).length > 0 && (
          <Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Execution Metadata
              </Typography>
              <Tooltip title="Copy metadata">
                <IconButton 
                  size="small" 
                  onClick={() => copyToClipboard(JSON.stringify(lastExecution.metadata, null, 2))}
                >
                  <CopyIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <Paper sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
              <Typography 
                variant="body2" 
                component="pre"
                sx={{ 
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {JSON.stringify(lastExecution.metadata, null, 2)}
              </Typography>
            </Paper>
          </Box>
        )}
      </Paper>

      {/* Node Information */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 2 }}>
          Node Information
        </Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Node ID
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {nodeInstance.id}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="caption" color="text.secondary">
              Type ID
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {nodeInstance.typeId}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="caption" color="text.secondary">
              Created At
            </Typography>
            <Typography variant="body2">
              {formatTimestamp(nodeInstance.createdAt)}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="caption" color="text.secondary">
              Updated At
            </Typography>
            <Typography variant="body2">
              {formatTimestamp(nodeInstance.updatedAt)}
            </Typography>
          </Box>
        </Box>

        {nodeInstance.data.disabled && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            This node is currently disabled and will be skipped during flow execution.
          </Alert>
        )}
      </Paper>

      {/* Quick Actions */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
        <Tooltip title="Execute this node">
          <IconButton 
            color="primary"
            sx={{ 
              border: 1, 
              borderColor: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.main',
                color: 'white'
              }
            }}
          >
            <ExecuteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};
