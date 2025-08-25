// src/components/nodes/types/DownloadTelegramVoiceNode.tsx
import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { NodeResultDisplay } from '../core/NodeResultDisplay';
import { CompactNodeContainer } from '../core/CompactNodeContainer';

export const DownloadTelegramVoiceNode: React.FC<NodeComponentProps> = (props) => {
  const { data } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;

  // Centralized execution data (fresh results prioritized)
  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete,
  });

  const renderMessagePreview = (): string => {
    const outputs = executionData.outputs as any;
    const display = executionData.displayData as any;

    // Prefer explicit display data if present
    const messageData = display?.message_data ?? outputs?.message_data;

    if (!messageData) {
      return 'No message data available';
    }

    try {
      // If voice_input is a data URI string, show a concise note
      if (typeof messageData.voice_input === 'string' && messageData.voice_input.startsWith('data:')) {
        const mime = messageData?.metadata?.mime_type || 'audio/*';
        return `Voice downloaded (base64 ${mime})`;
      }

      // If voice_input is still metadata dict, show file_id
      if (typeof messageData.voice_input === 'object' && messageData.voice_input?.file_id) {
        return `Waiting to download voice file_id=${messageData.voice_input.file_id}`;
      }

      // Fallback to compact JSON
      return JSON.stringify(messageData, null, 2);
    } catch {
      return 'Unable to render message preview';
    }
  };

  const customContent = (
    <>
      {(executionData.hasFreshResults || executionData.isExecuted) && (
        <NodeResultDisplay title="Message:" content={renderMessagePreview()} />
      )}

      {executionData.isSuccess && (
        <Alert
          severity="success"
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">Telegram voice downloaded successfully</Typography>
        </Alert>
      )}

      {!executionData.isExecuted && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Downloads Telegram voice by file_id and emits base64 data URI
          </Typography>
        </Box>
      )}
    </>
  );

  return (
    <>
      <CompactNodeContainer
        {...props}
        customColorName="orange"
      />
      {customContent}
    </>
  );
};
