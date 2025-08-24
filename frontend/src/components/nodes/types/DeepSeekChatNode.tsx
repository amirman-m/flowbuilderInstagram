// src/components/nodes/node-types/DeepSeekChatNode.tsx
import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Alert
} from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { useNodeConfigurationStatus } from '../hooks/useNodeConfigurationStatus';
import { NodeResultDisplay } from '../core/NodeResultDisplay';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { ModelConfigWarningDialog } from '../../dialogs/ModelConfigWarningDialog';

export const DeepSeekChatNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;
  
  // State for configuration warning dialog
  const [showConfigWarning, setShowConfigWarning] = useState(false);
  const [pendingExecution, setPendingExecution] = useState(false);
  
  // Use hooks for execution data
  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete
  });
  
  // Get current settings from instance
  const currentSettings = instance?.data?.settings || {};
  const { model = '', system_prompt = '', temperature = 0.7, max_tokens = 1000 } = currentSettings;
  
  // Check if required settings are configured
  const { isConfigured } = useNodeConfigurationStatus(
    id,
    currentSettings,
    ['model'] // Required settings for DeepSeekChatNode
  );

  // Handle execution with model check
  const handleBeforeExecute = () => {
    const model = (instance?.data?.settings as any)?.model;
    if (!model) {
      setShowConfigWarning(true);
      setPendingExecution(true);
      return false; // Prevent execution until dialog is handled
    }
    return true;
  };
  
  // Continue execution without model
  const handleContinueAnyway = () => {
    setShowConfigWarning(false);
    
    // Execute the node directly without opening settings
    if (pendingExecution) {
      setPendingExecution(false);
      
      // Get the execution function from CompactNodeContainer
      const executionService = nodeData.onExecute;
      if (executionService) {
        // Call execution directly with required nodeId parameter
        setTimeout(() => {
          executionService(id);
        }, 100);
      }
    }
  };
  
  // Cancel execution
  const handleCancelExecution = () => {
    setShowConfigWarning(false);
    setPendingExecution(false);
    // Just close the dialog, don't do anything else
  };

  // Execution handlers will be managed by CompactNodeContainer

  // Convert any AI response payload to plain text, removing emojis/HTML/markdown
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

  // Custom content for the DeepSeekChatNode
  const customContent = (
    <>
      {/* Configuration Display */}
      {!executionData.isExecuted && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Model: {model || 'Not configured'}
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

      {/* Execution Results Display */}
      {(executionData.hasFreshResults || executionData.isExecuted) && (
        <NodeResultDisplay
          title="AI Response:"
          content={(() => {
            const displayData = executionData.displayData;
            const outputs = executionData.outputs;
            
            // Try to get AI response from different locations
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
      
      {/* Success indicator for fresh execution */}
      {executionData.isSuccess && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">
            AI response generated successfully
          </Typography>
        </Alert>
      )}
      
      {/* Warning indicator for unconfigured settings */}
      {!isConfigured && !executionData.isExecuted && (
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">
            Model not configured. Please configure settings.
          </Typography>
        </Alert>
      )}
    </>
  );

  return (
    <>
      <CompactNodeContainer
        {...props}
        customColorName="cyan"
        onBeforeExecute={handleBeforeExecute}
      />
      
      {/* Custom content with warnings and status indicators */}
      {customContent}
      
      {/* Modern configuration warning dialog */}
      <ModelConfigWarningDialog
        open={showConfigWarning}
        onClose={handleCancelExecution}
        onContinue={handleContinueAnyway}
        nodeType="DeepSeek Chat"
        message="DeepSeek node requires a Model before execution. Continue anyway?"
      />
    </>
  );
};
