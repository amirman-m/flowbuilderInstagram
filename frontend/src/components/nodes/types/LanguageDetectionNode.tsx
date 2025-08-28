// src/components/nodes/types/LanguageDetectionNode.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon, Language as LanguageIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { useNodeConfigurationStatus } from '../hooks/useNodeConfigurationStatus';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { NodeResultDisplay } from '../core/NodeResultDisplay';
import { errorService } from '../../../services/errorService';
import { useReactFlow } from '@xyflow/react';

export const LanguageDetectionNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;

  // State for configuration warnings and execution flow
  const [showConfigWarning, setShowConfigWarning] = useState(false);
  const [pendingExecution, setPendingExecution] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  
  // errorService is already imported as a singleton

  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete,
  });

  const settings = instance?.data?.settings || {};
  const { model_name = 'Mike0307/multilingual-e5-language-detection' } = settings;

  // Check if node has connected inputs - input_text is required
  useNodeConfigurationStatus(id, settings, []);
  
  // Check specifically for the input_text port connection by inspecting React Flow edges
  const { getEdges } = useReactFlow();
  const hasInputText = useMemo(() => {
    const edges = getEdges();
    // Backend defines required input port id as 'message_data'. Consider connected if any edge targets it.
    return edges.some((e) => e.target === id && (e.targetHandle === 'message_data'));
  }, [getEdges, id]);

  // Check for input_text on mount and show error if missing
  useEffect(() => {
    if (!hasInputText && instance?.id) {
      // Only show the warning once when the component mounts
      setShowConfigWarning(true);
    }
  }, [hasInputText, instance?.id]);

  // Pre-execution validation
  const handleBeforeExecute = () => {
    // Language detection requires text input
    if (!hasInputText) {
      // Show dialog for confirmation
      setShowWarningDialog(true);
      setPendingExecution(true);
      
      // Log error for missing input
      const validationError = errorService.createValidationError(
        'Language detection requires text input. Please connect a text source to the message_data input port.',
        undefined,
        { nodeId: id, nodeType: nodeType }
      );
      errorService.logError(validationError);
      return false;
    }
    return true;
  };

  const handleContinueAnyway = () => {
    setShowWarningDialog(false);
    setShowConfigWarning(false);
    if (pendingExecution) {
      setPendingExecution(false);
      const exec = nodeData.onExecute;
      if (exec) setTimeout(() => exec(id), 50);
    }
  };

  const handleCancelExecution = () => {
    setShowWarningDialog(false);
    setShowConfigWarning(false);
    setPendingExecution(false);
  };

  // Extract data from execution results using consistent pattern
  const { outputs, isExecuted, isSuccess, isError } = executionData;
  const errorMessage = outputs?.error?.message || 'Error during language detection';
  
  // Primary output is detected_language
  const detectedLanguage: string = outputs?.detected_language || '';
  
  // Extract metadata from message_data
  const messageData: any = outputs?.message_data || {};
  const score: number | undefined = messageData?.metadata?.language_detection?.score;
  const inputPreview: string = messageData?.input_text || '';
  const modelUsed: string = messageData?.metadata?.language_detection?.model || model_name;
  
  // Format model name for display
  const displayModelName = String(modelUsed).split('/').pop() || modelUsed;
  
  const truncate = (text: string, max = 300) => (text && text.length > max ? text.slice(0, max) + '…' : text || '');

  const customContent = (
    <>
      {/* Settings summary when not executed */}
      {!isExecuted && (
        <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip 
            size="small" 
            icon={<LanguageIcon sx={{ fontSize: '0.8rem' }} />}
            label={`Model: ${displayModelName}`}
            sx={{ backgroundColor: '#f3f0ff', color: '#5c38a1' }} 
          />
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Input: text from connected node
          </Typography>
        </Box>
      )}

      {/* Detected language */}
      {isExecuted && detectedLanguage && (
        <NodeResultDisplay
          title="Detected Language"
          content={`${detectedLanguage}${typeof score === 'number' ? ` (confidence: ${score.toFixed(3)})` : ''}`}
          backgroundColor="#fff8e6"
        />
      )}

      {/* Input text preview */}
      {isExecuted && inputPreview && (
        <NodeResultDisplay
          title="Input Preview"
          content={truncate(String(inputPreview), 400)}
        />
      )}

      {/* Model metadata */}
      {isExecuted && modelUsed && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Model: {displayModelName}
          </Typography>
        </Box>
      )}

      {/* Success indicator */}
      {isSuccess && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
          <Typography variant="caption">Language detection completed</Typography>
        </Alert>
      )}
      
      {/* Error indicator */}
      {isError && (
        <Alert severity="error" sx={{ mt: 1, fontSize: '0.75rem' }}>
          <Typography variant="caption">{errorMessage || 'Error during language detection'}</Typography>
        </Alert>
      )}

      {/* Warning for no connected inputs */}
      {showConfigWarning && !isExecuted && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
          <Typography variant="caption">Missing required input: message_data. Connect a text source to the message_data port.</Typography>
        </Alert>
      )}
    </>
  );

  return (
    <>
      <CompactNodeContainer
        {...props}
        customColorName="orange"
        showExecuteButton={true}
        showDeleteButton={true}
        onBeforeExecute={handleBeforeExecute}
      />
      {customContent}

      {/* Configuration warning dialog - proper modal dialog */}
      <Dialog 
        open={showWarningDialog} 
        onClose={handleCancelExecution}
        PaperProps={{
          sx: { minWidth: '300px', maxWidth: '400px' }
        }}
      >
        <DialogTitle sx={{ fontSize: '1rem' }}>
          <WarningIcon color="warning" sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1.2rem' }} />
          Missing Required Input
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            No text input is connected to this node. Language detection requires text input to function properly.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Please connect a text source to the input_text port or click "Continue Anyway" to execute without input.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelExecution} color="error" size="small">
            Cancel
          </Button>
          <Button onClick={handleContinueAnyway} color="primary" size="small">
            Continue Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
