// src/components/nodes/node-types/ChatInputNode.tsx
import React, { useState, useEffect } from 'react';
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
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeUpdate } = nodeData;
  const [nodeStatus, setNodeStatus] = useState<NodeExecutionStatus>(NodeExecutionStatus.PENDING);
  
  // Use hooks
  const nodeConfig = useNodeConfiguration(nodeType?.id || 'chat_input');
  const executionData = useExecutionData(nodeData);
  
  // Initialize node status based on lastExecution data
  useEffect(() => {
    // Check if the node has lastExecution data with success status
    if (instance?.data?.lastExecution?.status === 'success') {
      setNodeStatus(NodeExecutionStatus.SUCCESS);
      setStatusMessage('Execution completed successfully');
    } else if (instance?.data?.lastExecution?.status === 'error') {
      setNodeStatus(NodeExecutionStatus.ERROR);
      setStatusMessage('Execution failed');
    }
  }, [instance?.data?.lastExecution]);
  
  const handleExecute = async () => {
    setDialogOpen(true);
  };
  
  const handleSubmit = async () => {
    if (!inputText.trim() || !flowId || !id) return;
    
    try {
      setIsExecuting(true);
      console.log(' Executing Chat Input node via backend API...');
      setNodeStatus(NodeExecutionStatus.RUNNING);
      setStatusMessage('Executing...');
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
      if (result && result.outputs) {
        setNodeStatus(NodeExecutionStatus.SUCCESS);
        setStatusMessage('Execution completed successfully');
        if (nodeData.onNodeUpdate && id) {
          nodeData.onNodeUpdate(id, {
            data: {
              ...(instance?.data || {}),
              lastExecution: {
                ...(result as any)
              },
              outputs: result.outputs || {}
            },
            updatedAt: new Date()
          });
          
          console.log(' Node state updated with execution results:');
        } else {
          console.warn(' Could not update node state: onNodeUpdate function not available');
        }
      }
      
    } catch (error: any) {
      console.error(' Backend execution failed:', error);
      setNodeStatus(NodeExecutionStatus.ERROR);
      setStatusMessage('Execution failed - no outputs');
      // Keep dialog open on error so user can retry
    } finally {
      setIsExecuting(false);
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
          <Typography variant="h6">Enter Message Input</Typography>
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
              disabled={!inputText.trim() || isExecuting}
            >
              {isExecuting ? 'Executing...' : 'Submit'}
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
      status={nodeStatus}
      statusMessage={statusMessage}
      isExecuting={isExecuting}
      onExecute={handleExecute}
      customContent={customContent}
    />
  );
};