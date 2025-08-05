import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import {
  Box, 
  Paper, 
  Typography, 
  IconButton, 
  Tooltip, 
  Zoom, 
  CircularProgress, 
  Alert,
  Button,
  TextField
} from '@mui/material';
import { 
  Delete as DeleteIcon,
  PlayArrow as ExecuteIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { baseNodeStyles, getCategoryColor } from '../styles';
import { NodeCategory } from '../../../types/nodes';
import { useExecutionData } from '../hooks/useExecutionData';
import { API_BASE_URL } from '../../../services/api';

// Telegram Logo SVG Component (reused from TelegramInputNode)
const TelegramLogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 256 256" 
    fill="currentColor"
    style={{ flexShrink: 0 }}
  >
    <path d="M128,0 C57.307,0 0,57.307 0,128 L0,128 C0,198.693 57.307,256 128,256 L128,256 C198.693,256 256,198.693 256,128 L256,128 C256,57.307 198.693,0 128,0 L128,0 Z" fill="#40B3E0" />
    <path d="M190.2826,73.6308 L167.4206,188.8978 C167.4206,188.8978 164.2236,196.8918 155.4306,193.0548 L102.6726,152.6068 L83.4886,143.3348 L51.1946,132.4628 C51.1946,132.4628 46.2386,130.7048 45.7586,126.8678 C45.2796,123.0308 51.3546,120.9528 51.3546,120.9528 L179.7306,70.5928 C179.7306,70.5928 190.2826,65.9568 190.2826,73.6308" fill="#FFFFFF" />
    <path d="M98.6178,187.6035 C98.6178,187.6035 97.0778,187.4595 95.1588,181.3835 C93.2408,175.3085 83.4888,143.3345 83.4888,143.3345 L161.0258,94.0945 C161.0258,94.0945 165.5028,91.3765 165.3428,94.0945 C165.3428,94.0945 166.1418,94.5735 163.7438,96.8115 C161.3458,99.0505 102.8328,151.6475 102.8328,151.6475" fill="#D2E5F1" />
  </svg>
);

// Extend NodeComponentProps to include flowId
interface TelegramMessageActionNodeProps extends NodeComponentProps {
  flowId?: string;
}

export const TelegramMessageActionNode: React.FC<TelegramMessageActionNodeProps> = ({ data, selected, id, flowId }) => {
  const [settingsValidationState, setSettingsValidationState] = useState<'error' | 'success' | 'none'>('none');
  const [isExecuting, setIsExecuting] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [chatId, setChatId] = useState('');
  
  // Access React Flow instance to get nodes and edges
  const { getNodes, getEdges } = useReactFlow();
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;
  const categoryColor = getCategoryColor(NodeCategory.ACTION);
  
  // Use execution data hook to get fresh execution results
  const executionData = useExecutionData(nodeData);
  
  // Get current settings from instance
  const currentSettings = instance?.data?.settings || {};
  
  // Initialize settings from instance data
  useEffect(() => {
    if (currentSettings.access_token) {
      setAccessToken(currentSettings.access_token);
    }
    if (currentSettings.chat_id) {
      setChatId(currentSettings.chat_id);
    }
  }, [currentSettings.access_token, currentSettings.chat_id]);
  
  // Settings handlers
  const updateSettings = (newSettings: any) => {
    if (nodeData.onNodeUpdate) {
      nodeData.onNodeUpdate(id, {
        data: {
          ...instance.data,
          settings: { ...currentSettings, ...newSettings }
        }
      });
    }
  };
  
  // Validate settings whenever they change
  useEffect(() => {
    // For this node, settings are optional as they can be obtained from Telegram Input node
    // Just validate format if provided
    const token = currentSettings?.access_token || accessToken;
    const chatIdValue = currentSettings?.chat_id || chatId;
    
    if ((token && token.length < 10) || (chatIdValue && !/^-?\d+$/.test(chatIdValue))) {
      setSettingsValidationState('error');
    } else {
      setSettingsValidationState('success');
    }
  }, [currentSettings, accessToken, chatId]);
  
  // Handle node deletion
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (nodeData.onNodeDelete) {
      nodeData.onNodeDelete(id);
    }
  };
  
  // Function to collect input data from connected nodes
  const collectInputsFromConnectedNodes = async (): Promise<Record<string, any>> => {
    const nodes = getNodes();
    const edges = getEdges();
    const inputs: Record<string, any> = {};
    
    // Find all edges that connect to this node
    const incomingEdges = edges.filter(edge => edge.target === id);
    
    // For each incoming edge, find the source node and get its output
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(node => node.id === edge.source);
      if (sourceNode && sourceNode.data && sourceNode.data.instance) {
        const sourceInstance = sourceNode.data.instance as { data?: { lastExecution?: { outputs?: Record<string, any> } } };
        const sourceData = sourceInstance.data || {} as any;
        const lastExecution = sourceData.lastExecution || {};
        const outputs = lastExecution.outputs || {};
        
        // Map the output to the input port
        if (edge.targetHandle) {
          inputs[edge.targetHandle] = outputs[edge.sourceHandle || 'output'] || '';
        }
      }
    }
    
    return inputs;
  };
  
  // Handle node execution
  const handleExecute = async (event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (isExecuting) {
      return;
    }
    
    setIsExecuting(true);
    
    try {
      // Collect inputs from connected nodes
      const inputs = await collectInputsFromConnectedNodes();
      
      // Prepare execution context
      const executionContext = {
        nodeId: id,
        nodeTypeId: nodeType.id,
        inputs,
        settings: currentSettings,
        flowId: flowId  // Add flowId to context
      };
      
      console.log('🚀 Telegram Message Action Node - Executing with context:', executionContext);
      
      // Make direct API call to backend
      const response = await fetch(`${API_BASE_URL}/nodes/execute/${executionContext.nodeTypeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session authentication
        body: JSON.stringify(executionContext),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to execute node');
      }
      
      const result = await response.json();
      console.log('✅ Telegram Message Action Node - Execution Result:', result);
      
      // Update the node instance with execution results
      if (nodeData.onNodeUpdate) {
        nodeData.onNodeUpdate(id, {
          data: {
            ...instance.data,
            inputs,
            lastExecution: {
              status: 'success',
              timestamp: new Date().toISOString(),
              inputs,
              outputs: result.outputs,
              logs: result.logs,
              executionTime: result.execution_time
            }
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Telegram Message Action Node - Execution Error:', error);
      
      // Update node with error status
      if (nodeData.onNodeUpdate) {
        nodeData.onNodeUpdate(id, {
          data: {
            ...instance.data,
            lastExecution: {
              status: 'error',
              timestamp: new Date().toISOString(),
              error: error instanceof Error ? error.message : String(error)
            }
          }
        });
      }
      
    } finally {
      setIsExecuting(false);
    }
  };
  
  // Get the current border color based on validation state
  const getBorderColor = () => {
    if (settingsValidationState === 'error') {
      return '#f44336';
    }
    return selected ? categoryColor : `${categoryColor}80`;
  };
  
  // Get the background color
  const getBackgroundColor = () => {
    return selected ? `${categoryColor}10` : 'white';
  };
  
  // Determine if the node is ready for execution - used for conditional rendering
  
  return (
    <>
      <Paper
        sx={{
          ...baseNodeStyles,
          borderColor: getBorderColor(),
          borderWidth: selected ? 3 : 2,
          backgroundColor: getBackgroundColor(),
        }}
      >
        {/* Input Handle */}
        {nodeType.ports.inputs.map((port: any, index: number) => (
          <Handle
            key={port.id}
            type="target"
            position={Position.Left}
            id={port.id}
            style={{
              top: `${20 + (index * 20)}px`,
              background: categoryColor,
              border: '2px solid white',
              width: 12,
              height: 12,
            }}
          />
        ))}
        
        {/* Settings button removed */}
        
        {/* Warning icon for invalid settings */}
        {settingsValidationState === 'error' && (
          <Box sx={{ position: 'absolute', top: 5, right: 35 }}>
            <Zoom in={true}>
              <Tooltip title="Invalid settings. Please check your configuration.">
                <WarningIcon sx={{ color: '#f44336', fontSize: 20 }} />
              </Tooltip>
            </Zoom>
          </Box>
        )}

        {/* Node Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ color: categoryColor, mr: 1 }}>
            <TelegramLogo size={20} />
          </Box>
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            {instance.label || "Send Telegram Message"}
          </Typography>
          {/* Execution button */}
          <Tooltip title={isExecuting ? "Sending message..." : "Send Message"}>
            <IconButton 
              size="small" 
              onClick={handleExecute} 
              sx={{ ml: 0.5 }}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <CircularProgress size={16} />
              ) : (
                <ExecuteIcon fontSize="small" color="primary" />
              )}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={handleDelete} sx={{ ml: 0.5 }}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Box>

        {/* Node Category */}
        <Typography
          variant="caption"
          sx={{
            backgroundColor: `${categoryColor}20`,
            color: categoryColor,
            fontSize: '0.7rem',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            display: 'inline-block'
          }}
        >
          {NodeCategory.ACTION}
        </Typography>
        
        {/* Execution Results Display */}
        {executionData.hasFreshResults && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: categoryColor }}>
              Message Sent:
            </Typography>
            {executionData.displayData && (executionData.displayData as any).message_sent && (
              <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
                {(executionData.displayData as any).message_sent}
              </Typography>
            )}
            {executionData.displayData && (executionData.displayData as any).chat_id && (
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                Chat ID: {(executionData.displayData as any).chat_id} • {new Date((executionData.displayData as any).timestamp).toLocaleTimeString()}
              </Typography>
            )}
          </Box>
        )}
        
        {/* Success/Error indicators */}
        {executionData.hasFreshResults && executionData.isSuccess && (
          <Alert 
            severity="success" 
            icon={<CheckCircleIcon />}
            sx={{ mt: 1, fontSize: '0.75rem' }}
          >
            <Typography variant="caption">
              Message sent successfully
              {executionData.executionTime && ` in ${executionData.executionTime.toFixed(2)}ms`}
            </Typography>
          </Alert>
        )}
        
        {executionData.hasFreshResults && executionData.isError && (
          <Alert 
            severity="error" 
            icon={<ErrorIcon />}
            sx={{ mt: 1, fontSize: '0.75rem' }}
          >
            <Typography variant="caption">
              {(executionData as any).error || "Failed to send message"}
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* Settings Dialog removed */}
    </>
  );
};
