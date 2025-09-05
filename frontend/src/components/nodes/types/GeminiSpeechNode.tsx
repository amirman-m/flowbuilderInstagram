import React, { useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { useNodeConfigurationStatus } from '../hooks/useNodeConfigurationStatus';
import { NodeResultDisplay } from '../core/NodeResultDisplay';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { ModelConfigWarningDialog } from '../../dialogs/ModelConfigWarningDialog';

export const GeminiSpeechNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;

  const [showConfigWarning, setShowConfigWarning] = useState(false);
  const [pendingExecution, setPendingExecution] = useState(false);

  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete
  });

  const currentSettings = instance?.data?.settings || {};
  const { model = '', voice = 'default', speed = 1.0, response_format = 'mp3' } = currentSettings;

  const { isConfigured } = useNodeConfigurationStatus(
    id,
    currentSettings,
    ['model', 'voice']
  );

  const handleBeforeExecute = () => {
    const model = (instance?.data?.settings as any)?.model;
    const voice = (instance?.data?.settings as any)?.voice;
    if (!model || !voice) {
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
      const executionService = nodeData.onExecute;
      if (executionService) {
        setTimeout(() => {
          executionService(id);
        }, 100);
      }
    }
  };

  const handleCancelExecution = () => {
    setShowConfigWarning(false);
    setPendingExecution(false);
  };

  const customContent = (
    <>
      {!executionData.isExecuted && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Model: {model || 'Not configured'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Voice: {voice} | Speed: {speed}x
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Format: {response_format}
          </Typography>
        </Box>
      )}

      {(executionData.hasFreshResults || executionData.isExecuted) && (
        <NodeResultDisplay
          title="Speech Generated:"
          content={(() => {
            const outputs = executionData.outputs;
            if (outputs?.voice_output) {
              return `Audio generated successfully (${voice} voice, ${response_format} format)`;
            }
            return 'Speech generation completed';
          })()}
        />
      )}

      {executionData.isSuccess && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">Speech generated successfully</Typography>
        </Alert>
      )}

      {!isConfigured && !executionData.isExecuted && (
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">Model and voice not configured. Please configure settings.</Typography>
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
      
      <ModelConfigWarningDialog
        open={showConfigWarning}
        onClose={handleCancelExecution}
        onContinue={handleContinueAnyway}
        nodeType="Google Gemini Speech"
        message="Gemini Speech node requires Model and Voice before execution. Continue anyway?"
      />
    </>
  );
};
