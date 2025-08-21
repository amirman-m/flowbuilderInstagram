// src/components/nodes/node-types/OpenAIChatNode.tsx
import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { useNodeConfigurationStatus } from '../hooks/useNodeConfigurationStatus';
import { NodeResultDisplay } from '../core/NodeResultDisplay';
import { CompactNodeContainer } from '../core/CompactNodeContainer';

// (Icon handled via NODE_ICONS in presenter; no inline logo needed.)

export const OpenAIChatNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;

  // Use execution data hook
  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete
  });

  // Current settings
  const currentSettings = instance?.data?.settings || {};
  const { model = '', system_prompt = '', temperature = 0.7 } = currentSettings;

  // Config status (require model at minimum)
  const { isConfigured } = useNodeConfigurationStatus(
    id,
    currentSettings,
    ['model']
  );

  // Convert any AI response payload to plain text
  const toPlainText = (input: any): string => {
    let text = '';
    if (typeof input === 'string') {
      text = input;
    } else if (input && typeof input === 'object') {
      if (typeof (input as any).aiResponse === 'string') {
        text = (input as any).aiResponse;
      } else if (typeof (input as any).ai_response === 'string') {
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
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/[*_`>#-]+/g, ' ');
    return text.replace(/\s+/g, ' ').trim();
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
          title="AI Response:"
          content={(() => {
            const displayData = executionData.displayData;
            const outputs = executionData.outputs;

            if (displayData?.aiResponse) {
              return toPlainText(displayData.aiResponse);
            } else if (outputs?.ai_response) {
              return toPlainText(outputs.ai_response);
            } else if (outputs?.aiResponse) {
              return toPlainText(outputs.aiResponse);
            } else if (displayData && typeof displayData === 'object') {
              return toPlainText(displayData);
            } else {
              return 'No AI response available';
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
          <Typography variant="caption">AI response generated successfully</Typography>
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
      />
      {customContent}
    </>
  );
};
