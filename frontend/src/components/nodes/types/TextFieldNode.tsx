// src/components/nodes/types/TextFieldNode.tsx
import React from 'react';
import { 
  Box, Typography, Alert
} from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { useExecutionData } from '../hooks';
import { NodeResultDisplay } from '../core/NodeResultDisplay';

export const TextFieldNode: React.FC<NodeComponentProps> = (props) => {
  const { data } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;
  
  // Use hooks for execution data
  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete
  });
  
  // Get current settings from instance
  const currentSettings = instance?.data?.settings || {};
  const { text_content = '' } = currentSettings;
  // Custom content for the TextFieldNode
  const customContent = (
    <>
      {/* Configuration Display */}
      {!executionData.isExecuted && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Text Content: {text_content || 'Not configured'}
          </Typography>
        </Box>
      )}

      {/* Execution Results Display */}
      {(executionData.hasFreshResults || executionData.isExecuted) && (
        <NodeResultDisplay
          title="Output Data:"
          content={(() => {
            const outputs = executionData.outputs;
            
            if (outputs?.output_data) {
              if (typeof outputs.output_data === 'object') {
                return JSON.stringify(outputs.output_data, null, 2);
              } else {
                return String(outputs.output_data);
              }
            } else {
              return 'No output data available';
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
            Text field processed successfully
          </Typography>
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
      
      {/* Custom Content */}
      {customContent}
    </>
  );
};
