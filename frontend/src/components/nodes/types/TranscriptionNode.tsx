// src/components/nodes/node-types/TranscriptionNode.tsx
import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { NodeResultDisplay } from '../core/NodeResultDisplay';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { useNodeInputs } from '../hooks';

export const TranscriptionNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;

  // Centralized execution data (fresh results prioritized)
  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete,
  });

  // Convert any AI response payload to plain text, similar to DeepSeekChatNode
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
    // Strip HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    // Strip basic markdown tokens
    text = text.replace(/[*_`>#-]+/g, ' ');
    // Collapse whitespace
    return text.replace(/\s+/g, ' ').trim();
  };

  // Custom execution handler to ensure voice input is properly prepared
  const handleCustomExecute = () => {
    // This will be called before the node is executed
    console.log('🎤 TranscriptionNode: Preparing voice input for transcription');
    
    // No need to do anything special here - the input normalization
    // will be handled by the TranscriptionNodeExecutor
    return true;
  };

  // Custom input collector wrapper to ensure send_to_transcription is set to true
  const handleBeforeExecute = async () => {
    console.log('🎤 TranscriptionNode: Preparing for execution');
    return true;
  };

  // Custom input collector to normalize inputs before execution
  const customInputCollector = async () => {
    // Get the standard input collector from useNodeInputs
    const { collectInputs } = useNodeInputs(id);
    
    // Collect inputs using the standard collector
    const inputs = await collectInputs();
    
    console.log('🎤 TranscriptionNode: Original inputs:', inputs);
    
    // Normalize the inputs to ensure send_to_transcription is true
    const normalizedInputs = { ...inputs };
    
    // Case 1: Direct message_data with voice_input
    if (normalizedInputs.message_data && typeof normalizedInputs.message_data === 'object') {
      if (normalizedInputs.message_data.voice_input) {
        // Ensure send_to_transcription is true
        normalizedInputs.message_data.send_to_transcription = true;
        
        // Extract voice_data for direct access
        normalizedInputs.voice_data = normalizedInputs.message_data.voice_input;
        
        // Try to extract content_type if available
        if (normalizedInputs.message_data.metadata && normalizedInputs.message_data.metadata.content_type) {
          normalizedInputs.content_type = normalizedInputs.message_data.metadata.content_type;
        } else {
          // Default content type if not provided
          normalizedInputs.content_type = 'audio/wav';
        }
      }
    }
    
    // Case 2: Scan all input entries for voice_input
    for (const [key, value] of Object.entries(normalizedInputs)) {
      if (value && typeof value === 'object') {
        // Check if this object has voice_input
        if (value.voice_input) {
          // Ensure send_to_transcription is true
          value.send_to_transcription = true;
          
          // Extract voice_data for direct access
          normalizedInputs.voice_data = value.voice_input;
          
          // Try to extract content_type
          if (value.metadata && value.metadata.content_type) {
            normalizedInputs.content_type = value.metadata.content_type;
          } else {
            // Default content type if not provided
            normalizedInputs.content_type = 'audio/wav';
          }
        }
      }
    }
    
    console.log('🎤 TranscriptionNode: Normalized inputs:', normalizedInputs);
    return normalizedInputs;
  };

  // Custom content for Transcription node (AI response only)
  const customContent = (
    <>
      {(executionData.hasFreshResults || executionData.isExecuted) && (
        <NodeResultDisplay
          title="AI Response:"
          content={(() => {
            const displayData = executionData.displayData;
            const outputs = executionData.outputs;

            // Show only AI response, matching DeepSeekChatNode behavior
            if (displayData?.aiResponse) {
              return toPlainText(displayData.aiResponse);
            }
            if (outputs?.ai_response) {
              return toPlainText(outputs.ai_response);
            }
            if (outputs?.aiResponse) {
              return toPlainText(outputs.aiResponse);
            }
            return 'No AI response available';
          })()}
        />
      )}

      {executionData.isSuccess && (
        <Alert
          severity="success"
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">Audio transcribed successfully</Typography>
        </Alert>
      )}
    </>
  );

  return (
    <>
      <CompactNodeContainer
        {...props}
        customColorName="lime"
        onBeforeExecute={handleBeforeExecute}
        inputCollector={customInputCollector}
      />
      {customContent}
    </>
  );
};
