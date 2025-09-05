import React, { useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { useNodeConfigurationStatus } from '../hooks/useNodeConfigurationStatus';
import { NodeResultDisplay } from '../core/NodeResultDisplay';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { ModelConfigWarningDialog } from '../../dialogs/ModelConfigWarningDialog';

export const GeminiImageGenerationNode: React.FC<NodeComponentProps> = (props) => {
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
  const { model = '', prompt = '', size = '1024x1024', quality = 'standard' } = currentSettings;

  const { isConfigured } = useNodeConfigurationStatus(
    id,
    currentSettings,
    ['model']
  );

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
            Size: {size} | Quality: {quality}
          </Typography>
          {prompt && (
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
              title={prompt}
            >
              Prompt: {prompt}
            </Typography>
          )}
        </Box>
      )}

      {(executionData.hasFreshResults || executionData.isExecuted) && (
        <NodeResultDisplay
          title="Generated Image:"
          content={(() => {
            const outputs = executionData.outputs;
            if (outputs?.generated_image) {
              const imageData = outputs.generated_image;
              if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
                return `Image generated successfully (${size})`;
              } else if (typeof imageData === 'object' && imageData.generated_image) {
                return `Image generated successfully (${size})`;
              }
            }
            return 'Image generation completed';
          })()}
        />
      )}

      {executionData.isSuccess && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">Image generated successfully</Typography>
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
        nodeType="Google Gemini Image Generation"
        message="Gemini node requires a Model before execution. Continue anyway?"
      />
    </>
  );
};
