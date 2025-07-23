import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Divider
} from '@mui/material';
import { PlayArrow as PlayIcon, CheckCircle as CheckIcon } from '@mui/icons-material';

interface FlowExecutionDialogProps {
  open: boolean;
  onClose: () => void;
  flowName: string;
  triggerNodeId: string | null;
  onExecute: (triggerInputs: Record<string, any>) => Promise<void>;
}

interface ExecutionResult {
  flow_id: number;
  flow_name: string;
  trigger_node_id: string;
  execution_results: Record<string, any>;
  executed_at: string;
  total_nodes_executed: number;
}

export const FlowExecutionDialog: React.FC<FlowExecutionDialogProps> = ({
  open,
  onClose,
  flowName,
  triggerNodeId,
  onExecute
}) => {
  const [inputText, setInputText] = useState('');
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!inputText.trim()) return;

    try {
      setExecuting(true);
      setError(null);
      
      // Execute the flow with user input
      await onExecute({
        user_input: inputText.trim()
      });

      // Clear input after successful execution
      setInputText('');
      
    } catch (err: any) {
      console.error('Flow execution failed:', err);
      setError(err.response?.data?.detail || err.message || 'Flow execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleClose = () => {
    if (!executing) {
      setInputText('');
      setError(null);
      setExecutionResult(null);
      onClose();
    }
  };

  const renderExecutionResults = () => {
    if (!executionResult) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">
            Flow executed successfully!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {executionResult.total_nodes_executed} nodes executed at {new Date(executionResult.executed_at).toLocaleString()}
          </Typography>
        </Alert>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Execution Results:
        </Typography>
        
        {Object.entries(executionResult.execution_results).map(([nodeId, result]: [string, any]) => (
          <Box key={nodeId} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CheckIcon color="success" fontSize="small" sx={{ mr: 1 }} />
              <Typography variant="subtitle2">
                Node: {nodeId}
              </Typography>
              <Chip 
                label={result.status || 'completed'} 
                size="small" 
                color={result.status === 'success' ? 'success' : 'default'}
                sx={{ ml: 1 }}
              />
            </Box>
            
            {result.outputs && Object.keys(result.outputs).length > 0 && (
              <Box sx={{ ml: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Outputs: {JSON.stringify(result.outputs, null, 2)}
                </Typography>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <PlayIcon sx={{ mr: 1, color: 'primary.main' }} />
        Execute Flow: {flowName}
      </DialogTitle>
      
      <DialogContent>
        {!executionResult && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This flow will start execution from the trigger node{triggerNodeId ? ` (${triggerNodeId})` : ''}.
              Please provide the input for the trigger node below.
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Trigger Input"
              placeholder="Enter your message or input for the flow..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={executing}
              sx={{ mb: 2 }}
            />

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
          </>
        )}

        {renderExecutionResults()}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={executing}>
          {executionResult ? 'Close' : 'Cancel'}
        </Button>
        
        {!executionResult && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!inputText.trim() || executing}
            startIcon={executing ? <CircularProgress size={16} /> : <PlayIcon />}
          >
            {executing ? 'Executing Flow...' : 'Execute Flow'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
