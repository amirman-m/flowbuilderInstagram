// src/components/nodes/node-types/TelegramNode.tsx
import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Paper, Box, Typography, IconButton, Dialog, 
  TextField, Button, Chip, Alert
} from '@mui/material';
import { Send as SendIcon, Delete as DeleteIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { baseNodeStyles, getCategoryColor } from '..';
import { NodeCategory, NodeExecutionStatus } from '../../../types/nodes';
import { nodeService } from '../../../services/nodeService';
import { useParams } from 'react-router-dom';
import { useExecutionData } from '../hooks/useExecutionData';

// Telegram Logo SVG Component
const TelegramLogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 256 256" 
    style={{ flexShrink: 0 }}
  >
    <g>
      <path d="M128,0 C57.307,0 0,57.307 0,128 L0,128 C0,198.693 57.307,256 128,256 L128,256 C198.693,256 256,198.693 256,128 L256,128 C256,57.307 198.693,0 128,0 L128,0 Z" fill="#40B3E0" />
      <path d="M190.2826,73.6308 L167.4206,188.8978 C167.4206,188.8978 164.2236,196.8918 155.4306,193.0548 L102.6726,152.6068 L83.4886,143.3348 L51.1946,132.4628 C51.1946,132.4628 46.2386,130.7048 45.7586,126.8678 C45.2796,123.0308 51.3546,120.9528 51.3546,120.9528 L179.7306,70.5928 C179.7306,70.5928 190.2826,65.9568 190.2826,73.6308" fill="#FFFFFF" />
      <path d="M98.6178,187.6035 C98.6178,187.6035 97.0778,187.4595 95.1588,181.3835 C93.2408,175.3085 83.4888,143.3345 83.4888,143.3345 L161.0258,94.0945 C161.0258,94.0945 165.5028,91.3765 165.3428,94.0945 C165.3428,94.0945 166.1418,94.5735 163.7438,96.8115 C161.3458,99.0505 102.8328,151.6475 102.8328,151.6475" fill="#D2E5F1" />
      <path d="M122.9015,168.1154 L102.0335,187.1414 C102.0335,187.1414 100.4025,188.3794 98.6175,187.6034 L102.6135,152.2624" fill="#B5CFE4" />
    </g>
  </svg>
);

export const TelegramNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
  const { flowId } = useParams<{ flowId: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [showCountdown, setShowCountdown] = useState(false);

  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeUpdate } = nodeData;
  const categoryColor = getCategoryColor(NodeCategory.ACTION);

  const executionData = useExecutionData(nodeData);

  const handleGetChatId = async () => {
    setShowCountdown(true);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(timer);
          setShowCountdown(false);
          // Here you would call the backend to get the chat_id
          // For now, we'll just close the dialog
          setDialogOpen(false);
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    const onNodeDelete = data?.onNodeDelete;
    if (onNodeDelete && id) {
      onNodeDelete(id);
    }
  };

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
            <TelegramLogo size={24} />
          </Box>
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            {instance.label || "Telegram"}
          </Typography>
          <IconButton 
            size="small" 
            sx={{ ml: 0.5 }}
            onClick={() => setDialogOpen(true)}
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
          label={NodeCategory.ACTION}
          size="small"
          sx={{
            backgroundColor: `${categoryColor}20`,
            color: categoryColor,
            fontSize: '0.7rem',
            height: '20px'
          }}
        />
        
        {/* Execution Results Display */}
        {executionData.hasFreshResults && (
          <Alert 
            severity={executionData.isSuccess ? "success" : "error"} 
            icon={executionData.isSuccess ? <CheckCircleIcon /> : undefined}
            sx={{ mt: 1, fontSize: '0.75rem' }}
          >
            <Typography variant="caption">
              {executionData.isSuccess ? "Message sent successfully" : "Failed to send message"}
            </Typography>
          </Alert>
        )}
        
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TelegramLogo size={24} />
            <Typography variant="h6">Get Chat ID</Typography>
          </Box>
          {showCountdown ? (
            <Box sx={{ my: 2 }}>
              <Typography>Please send a message to your bot. You have {countdown} seconds.</Typography>
            </Box>
          ) : (
            <Box sx={{ my: 2 }}>
              <Typography>To send messages to yourself, you first need to start a conversation with your bot.</Typography>
              <Button 
                variant="contained" 
                onClick={handleGetChatId}
                sx={{ mt: 2 }}
              >
                Start Chat ID Retrieval
              </Button>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          </Box>
        </Box>
      </Dialog>
    </>
  );
};