// src/components/nodes/node-types/ChatInputNode.tsx
import React, { useState } from 'react';
import { 
  Box, Typography, Dialog, TextField, Button, Alert
} from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { NodeExecutionStatus } from '../../../types/nodes';
import { nodeService } from '../../../services/nodeService';
import { useParams } from 'react-router-dom';
import { BaseNode } from '../core/BaseNode';
import { useNodeConfiguration, useExecutionData } from '../hooks';

export const ChatInputNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const { flowId } = useParams<{ flowId: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [executing, setExecuting] = useState(false);
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeUpdate } = nodeData;
  
  // Use our new modular hooks
  const nodeConfig = useNodeConfiguration(nodeType?.id || 'chat_input');
  const executionData = useExecutionData(nodeData);
  
  const handleExecute = async () => {
    setDialogOpen(true);
  };
  
  const handleSubmit = async () => {
    if (!inputText.trim() || !flowId || !id) return;
    
    try {
      setExecuting(true);
      console.log(' Executing Chat Input node via backend API...');
      
      // First, ensure the node is saved to the database
      console.log(' Auto-saving flow to ensure node exists in database...');
      try {
        await new Promise((resolve, reject) => {
          const saveFlowEvent = new CustomEvent('autoSaveFlow', {
            detail: { 
              nodeId: id, 
              reason: 'pre-execution',
              callback: (error?: Error) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(null);
                }
              }
            }
          });
          window.dispatchEvent(saveFlowEvent);
        });
        console.log(' Auto-save completed');
      } catch (saveError) {
        console.warn(' Auto-save failed, continuing with execution:', saveError);
      }
      
      // Call backend API to execute the Chat Input node
      const executionContext = {
        user_input: inputText.trim()
      };
      
      // Execute the node through the backend
      const result = await nodeService.execution.executeNode(
        parseInt(flowId), 
        id,
        executionContext
      );
      
      console.log(' Backend execution result:', result);
      
      setDialogOpen(false);
      setInputText('');
      
      // Update node state with execution results
      if (onNodeUpdate && result) {
        const lastExecution = {
          timestamp: new Date().toISOString(),
          status: result.status || NodeExecutionStatus.SUCCESS,
          outputs: result.outputs || {},
          startedAt: new Date().toISOString()
        };
        
        onNodeUpdate(id, {
          data: {
            ...instance.data,
            lastExecution
          }
        });
        
        console.log(' Node state updated with execution results:', lastExecution);
      } else {
        console.warn(' Could not update node state: onNodeUpdate function not available');
      }
    } catch (error: any) {
      console.error(' Backend execution failed:', error);
      // Keep dialog open on error so user can retry
    } finally {
      setExecuting(false);
    }
  };

  // Custom content for the ChatInputNode
  const customContent = (
    <>
      {/* Execution Results Display */}
      {executionData.hasFreshResults && executionData.displayData.type === 'message_data' && (
        <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: nodeConfig?.color }}>
            Latest Input:
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
            "{executionData.displayData.inputText}"
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            {executionData.displayData.metadata?.word_count} words • {new Date(executionData.displayData.timestamp).toLocaleTimeString()}
          </Typography>
        </Box>
      )}
      
      {/* Success indicator for fresh execution */}
      {executionData.hasFreshResults && executionData.isSuccess && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">
            Input processed successfully
          </Typography>
        </Alert>
      )}
      
      {/* Node-specific dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <Box sx={{ p: 3, width: 400 }}>
          <Typography variant="h6">Enter Chat Input</Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message here..."
            sx={{ my: 2 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={handleSubmit}
              disabled={!inputText.trim() || executing}
            >
              {executing ? 'Executing...' : 'Submit'}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </>
  );

  return (
    <BaseNode
      {...props}
      nodeTypeId="chat_input"
      nodeConfig={nodeConfig}
      onExecute={handleExecute}
      customContent={customContent}
      executionStatus={executing ? NodeExecutionStatus.RUNNING : undefined}
    />
  );
};