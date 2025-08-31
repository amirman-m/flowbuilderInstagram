// src/components/nodes/types/OpenAISpeechNode.tsx
import React, { useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { CompactNodeContainer } from '../core/CompactNodeContainer';

export const OpenAISpeechNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;

  const [showConfigWarning, setShowConfigWarning] = useState(false);
  const [pendingExecution, setPendingExecution] = useState(false);

  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete,
  });

  const currentSettings = instance?.data?.settings || {};
  const { model = '', voice = '', response_format = 'opus', speed = 1.0 } = currentSettings as any;

  const handleBeforeExecute = () => {
    // Require at least voice; model has default in backend but we surface for UX
    if (!voice) {
      setShowConfigWarning(true);
      setPendingExecution(true);
      return false;
    }
    return true;
  };

  const handleContinueAnyway = () => {
    setShowConfigWarning(false);
    if (pendingExecution) {
      setPendingExecution(false);
      const exec = nodeData.onExecute;
      if (exec) setTimeout(() => exec(id), 50);
    }
  };

  const handleCancelExecution = () => {
    setShowConfigWarning(false);
    setPendingExecution(false);
  };

  const audioSrc = (() => {
    const outputs = executionData.outputs as any;
    const displayData = executionData.displayData as any;
    return (
      (outputs && (outputs.voice_output || outputs.voiceOutput)) ||
      (displayData && (displayData.voice_output || displayData.voiceOutput)) ||
      ''
    );
  })();

  const customContent = (
    <>
      {!executionData.isExecuted && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Model: {model || 'tts-1'} | Voice: {voice || 'Not set'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Format: {response_format} | Speed: {speed}
          </Typography>
        </Box>
      )}

      {(executionData.hasFreshResults || executionData.isExecuted) && audioSrc && (
        <Box sx={{ mt: 1 }}>
          <audio controls src={audioSrc} style={{ width: '100%' }} />
        </Box>
      )}

      {executionData.isSuccess && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
          <Typography variant="caption">Speech generated successfully</Typography>
        </Alert>
      )}

      {(!voice) && !executionData.isExecuted && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1, fontSize: '0.75rem' }}>
          <Typography variant="caption">Voice is not configured. Please configure settings.</Typography>
        </Alert>
      )}
    </>
  );

  return (
    <>
      <CompactNodeContainer
        {...props}
        customColorName="indigo"
        onBeforeExecute={handleBeforeExecute}
      />
      {customContent}

      {/* Lightweight inline dialog replacement via alerts; if you have ModelConfigWarningDialog, you can wire it similarly */}
      {showConfigWarning && (
        <Box sx={{ mt: 1 }}>
          <Alert severity="warning" icon={<WarningIcon />} sx={{ fontSize: '0.75rem' }}>
            <Box>
              <Typography variant="caption">Voice is required before execution.</Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ color: 'primary.main', cursor: 'pointer' }}
                  onClick={handleContinueAnyway}
                >
                  Continue anyway
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'error.main', cursor: 'pointer' }}
                  onClick={handleCancelExecution}
                >
                  Cancel
                </Typography>
              </Box>
            </Box>
          </Alert>
        </Box>
      )}
    </>
  );
};
