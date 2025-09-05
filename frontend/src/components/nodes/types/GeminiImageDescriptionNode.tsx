import React, { useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { useNodeConfigurationStatus } from '../hooks/useNodeConfigurationStatus';
import { NodeResultDisplay } from '../core/NodeResultDisplay';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { ModelConfigWarningDialog } from '../../dialogs/ModelConfigWarningDialog';

export const GeminiImageDescriptionNode: React.FC<NodeComponentProps> = (props) => {
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
  const { model = '', system_prompt = '', temperature = 0.3 } = currentSettings;

  const { isConfigured } = useNodeConfigurationStatus(
    id,
    currentSettings,
    ['model']
  );

  const toPlainText = (input: any): string => {
    let text = '';
    if (typeof input === 'string') {
      text = input;
    } else if (input && typeof input === 'object') {
      if (typeof (input as any).ai_response === 'string') {
        text = (input as any).ai_response;
      } else {
        try {
          text = JSON.stringify(input);
        } catch {
          text = String(input);
        }
      }
    } else if (input != null) {
      text = String(input);
    }
    return text.replace(/\s+/g, ' ').trim();
  };

  const handleBeforeExecute = () => {
    const model = (instance?.data?.settings as any)?.model;
    if (!model) {
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
            Temperature: {temperature}
          </Typography>
          {system_prompt && (
            <Typography
              variant="caption"
              sx={{
                color: '#666',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '150px'
              }}
              title={system_prompt}
            >
              Prompt: {system_prompt}
            </Typography>
          )}
        </Box>
      )}

      {(executionData.hasFreshResults || executionData.isExecuted) && (
        <NodeResultDisplay
          title="Image Analysis:"
          content={(() => {
            const displayData = executionData.displayData;
            const outputs = executionData.outputs;

            if (outputs?.ai_response) {
              return toPlainText(outputs.ai_response);
            } else if (displayData && typeof displayData === 'object') {
              return toPlainText(displayData);
            } else {
              return 'No image analysis available';
            }
          })()}
        />
      )}

      {executionData.isSuccess && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">Image analyzed successfully</Typography>
        </Alert>
      )}

      {!isConfigured && !executionData.isExecuted && (
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">Model not configured. Please configure settings.</Typography>
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
        nodeType="Google Gemini Image Description"
        message="Gemini node requires a Model before execution. Continue anyway?"
      />
    </>
  );
};
