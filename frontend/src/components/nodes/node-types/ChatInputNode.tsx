// src/components/nodes/node-types/ChatInputNode.tsx
import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Paper, Box, Typography, IconButton, Dialog, 
  TextField, Button, Chip
} from '@mui/material';
import { Send as SendIcon, Delete as DeleteIcon, Message as MessageIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { baseNodeStyles, getCategoryColor } from '..';
import { NodeCategory, NodeExecutionStatus } from '../../../types/nodes';
import { nodeService } from '../../../services/nodeService';
import { useParams } from 'react-router-dom';

export const ChatInputNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
  const { flowId } = useParams<{ flowId: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [executing, setExecuting] = useState(false);
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeUpdate } = nodeData;
  const categoryColor = getCategoryColor(NodeCategory.TRIGGER); // Chat Input is always a trigger
  
  const handleExecute = () => {
    setDialogOpen(true);
  };
  
  const handleSubmit = async () => {
    if (!inputText.trim() || !flowId || !id) return;
    
    try {
      setExecuting(true);
      console.log('🚀 Executing Chat Input node via backend API...');
      
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
      
      console.log('✅ Backend execution result:', result);
      
      // Close dialog and reset input
      setDialogOpen(false);
      setInputText('');
      
      // Update node state with execution results
      if (onNodeUpdate && result) {
        // Create a lastExecution object with timestamp, outputs, and logs
        const lastExecution = {
          timestamp: new Date().toISOString(),
          status: result.status || NodeExecutionStatus.SUCCESS,
          outputs: result.outputs || {}
          // Note: logs are not part of the NodeExecutionResult type
        };
        
        // Update the node instance with execution results
        onNodeUpdate(id, {
          // Structure updates to match what handleNodeUpdate expects
          // handleNodeUpdate merges with node.data.instance
          data: {
            ...instance.data,
            lastExecution
          }
        });
        
        console.log('✅ Node state updated with execution results:', lastExecution);
      } else {
        console.warn('⚠️ Could not update node state: onNodeUpdate function not available');
      }
    } catch (error: any) {
      console.error('❌ Backend execution failed:', error);
      // Keep dialog open on error so user can retry
    } finally {
      setExecuting(false);
    }
  };
  
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    const onNodeDelete = data?.onNodeDelete;
    if (onNodeDelete && id) {
      onNodeDelete(id);
    }
  };
  
  // Node-specific rendering with custom dialog
  return (
    <>
      <Paper 
        sx={{
          ...baseNodeStyles,
          borderColor: selected ? categoryColor : `${categoryColor}80`,
          borderWidth: selected ? 3 : 2,
          backgroundColor: selected ? `${categoryColor}10` : 'white'
        }}
      >
        {/* Input Handles */}
        {nodeType.ports.inputs.map((port: any, index: number) => (
          <Handle
            key={port.id}
            type="target"
            position={Position.Left}
            id={port.id}
            style={{
              top: `${20 + (index * 20)}px`,
              backgroundColor: port.required ? categoryColor : '#999'
            }}
          />
        ))}
        
        {/* Node Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ color: categoryColor, mr: 1 }}>
            <MessageIcon />
          </Box>
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            {instance.label || "Chat Input"}
          </Typography>
          <IconButton 
            size="small" 
            sx={{ ml: 0.5 }}
            onClick={handleExecute}
          >
            <SendIcon fontSize="small" color="primary" />
          </IconButton>
          <IconButton 
            size="small" 
            sx={{ ml: 0.5 }}
            onClick={handleDelete}
          >
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Box>

        {/* Node Category */}
        <Chip
          label={NodeCategory.TRIGGER}
          size="small"
          sx={{
            backgroundColor: `${categoryColor}20`,
            color: categoryColor,
            fontSize: '0.7rem',
            height: '20px'
          }}
        />
        
        {/* Output Handles */}
        {nodeType.ports.outputs.map((port: any, index: number) => (
          <Handle
            key={port.id}
            type="source"
            position={Position.Right}
            id={port.id}
            style={{
              top: `${20 + (index * 20)}px`,
              backgroundColor: categoryColor
            }}
          />
        ))}
      </Paper>
      
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
};