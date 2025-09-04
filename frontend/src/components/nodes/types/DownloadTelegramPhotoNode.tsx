// src/components/nodes/types/DownloadTelegramPhotoNode.tsx
import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Image as ImageIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { NodeResultDisplay } from '../core/NodeResultDisplay';
import { CompactNodeContainer } from '../core/CompactNodeContainer';

export const DownloadTelegramPhotoNode: React.FC<NodeComponentProps> = (props) => {
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
      // If photo_input is a data URI string, show a concise note
      if (typeof messageData.photo_input === 'string' && messageData.photo_input.startsWith('data:')) {
        const mime = messageData?.metadata?.mime_type || 'image/*';
        const fileExt = messageData?.metadata?.file_extension || 'jpg';
        return `Photo downloaded (base64 ${mime}, .${fileExt})`;
      }

      // If photo_input is still metadata dict, show file_id
      if (typeof messageData.photo_input === 'object' && messageData.photo_input?.file_id) {
        return `Waiting to download photo file_id=${messageData.photo_input.file_id}`;
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
          <Typography variant="caption">Telegram photo downloaded successfully</Typography>
        </Alert>
      )}

      {!executionData.isExecuted && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Downloads Telegram photo by file_id and emits base64 data URI
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, gap: 0.5 }}>
            <ImageIcon sx={{ fontSize: '0.75rem', color: '#666' }} />
            <Typography variant="caption" sx={{ color: '#666' }}>
              Supports JPEG, PNG, WebP, GIF formats
            </Typography>
          </Box>
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
