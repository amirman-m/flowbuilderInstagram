import React from 'react';
import { Box, Alert } from '@mui/material';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';

/**
 * SendTelegramPhotoNode - A node that sends photos with optional captions to Telegram
 * Shows labeled input ports for better UX
 */
export const SendTelegramPhotoNode: React.FC<NodeComponentProps> = (props) => {
  const { data } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;

  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete,
  });

  const inputPorts = props.data?.nodeType?.ports?.inputs ?? [];

  // Map input handles to colors: photo = blue, caption = green
  const inputHandleGradientMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    inputPorts.forEach((port: any) => {
      const text = (port.label || port.name || '').toString().toLowerCase();
      if (text.includes('caption')) {
        // Use the same dark green as the caption label background to match exactly
        map[port.id] = '#065f46'; // solid green (no gradient)
      } else if (text.includes('photo')) {
        map[port.id] = 'linear-gradient(135deg, #3b82f6, #2563eb)'; // blue
      }
    });
    return map;
  }, [inputPorts]);

  const customContent = (
    <>
      {executionData.status === 'success' && executionData.outputs?.telegram_result && (
        <Alert severity="success" sx={{ mt: 1, fontSize: '0.75rem' }}>
          Photo sent to chat {executionData.outputs.telegram_result.chat_id}
          {executionData.outputs.telegram_result.caption && (
            <Box component="span" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
              Caption: {executionData.outputs.telegram_result.caption.length > 40 ? 
                `${executionData.outputs.telegram_result.caption.substring(0, 40)}...` : 
                executionData.outputs.telegram_result.caption}
            </Box>
          )}
        </Alert>
      )}
    </>
  );

  return (
    <Box sx={{ position: 'relative', width: 'fit-content', height: 'fit-content', overflow: 'visible' }}>
      {/* Core node UI */}
      <CompactNodeContainer
        {...props}
        customColorName="lime"
        inputHandleGradientMap={inputHandleGradientMap}
        showExecuteButton={true}
        showDeleteButton={true}
      />
      {customContent}

      {/* Overlay: non-interactive port labels aligned with handles */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10002,
          overflow: 'visible',
        }}
      >
        {/* Input labels (left) - positioned outside the node, aligned with handles */}
        {inputPorts.map((port: any, index: number) => {
          const topPercent = ((index + 1) / (inputPorts.length + 1)) * 100;
          const text = port.label || port.name;
          
          // Determine background color based on port name
          let bgColor = '#1e293b'; // default dark slate
          let borderColor = '#334155';
          
          if (text.toLowerCase().includes('photo')) {
            bgColor = '#1e40af'; // dark blue
            borderColor = '#3b82f6';
          } else if (text.toLowerCase().includes('caption')) {
            bgColor = '#065f46'; // dark green
            borderColor = '#10b981'; // lighter green border
          }
          
          return (
            <Box
              key={`input-label-${port.id}`}
              sx={{
                position: 'absolute',
                left: 0, // anchor to the node's left edge
                top: `${topPercent}%`,
                transform: 'translate(-12px, -50%)', // shift left by 12px to sit just outside
                backgroundColor: bgColor,
                color: '#ffffff',
                border: `1px solid ${borderColor}`,
                padding: '2px 5px',
                fontSize: '10px',
                fontWeight: 600,
                lineHeight: 1.2,
                textAlign: 'right',
                minWidth: 0,
                maxWidth: 64,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                borderRadius: '3px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
              title={text}
            >
              {text}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
