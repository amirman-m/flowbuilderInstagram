import React, { useState, useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  Box, 
  Typography, 
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField
} from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { useNodeConfiguration, useExecutionData } from '../hooks';
import { nodeService } from '../../../services/nodeService';
import { useParams } from 'react-router-dom';

// Telegram Logo SVG Component
const TelegramLogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-.38.24-1.07.7-.31.21-.66.32-1.02.32-.7-.01-1.36-.4-1.82-.73-.56-.4-.67-.63-.67-.99-.01-.7.27-.99.67-.99.09 0 .18.01.27.03.27.06.64.25 1.02.5l1.17.77c.42.28.85.42 1.27.42.26 0 .52-.05.78-.16.77-.32 1.37-.94 1.37-1.71 0-.17-.04-.33-.1-.49z"/>
  </svg>
);

export const TelegramMessageActionNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const { flowId } = useParams<{ flowId: string }>();
  const [validationState, setValidationState] = useState<'error' | 'success' | 'none'>('none');
  const [isExecuting, setIsExecuting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localAccessToken, setLocalAccessToken] = useState('');
  const [localChatId, setLocalChatId] = useState('');
  
  // Access React Flow instance to get nodes and edges
  const { getNodes, getEdges } = useReactFlow();
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;
  
  // Use our new modular hooks
  const nodeConfig = useNodeConfiguration(nodeType?.id || 'telegram_message_action');
  const executionData = useExecutionData(nodeData);
  
  // Get current settings from instance
  const currentSettings = instance?.data?.settings || {};
  
  // Initialize settings from instance data
  useEffect(() => {
    if (currentSettings.access_token) {
      setLocalAccessToken(currentSettings.access_token);
    }
    if (currentSettings.chat_id) {
      setLocalChatId(currentSettings.chat_id);
    }
  }, [currentSettings.access_token, currentSettings.chat_id]);
  
  // Validate settings whenever they change
  useEffect(() => {
    // For this node, settings are optional as they can be obtained from Telegram Input node
    // Just validate format if provided
    const token = currentSettings?.access_token || localAccessToken;
    const chatIdValue = currentSettings?.chat_id || localChatId;
    
    if ((token && token.length < 10) || (chatIdValue && !/^-?\d+$/.test(chatIdValue))) {
      setValidationState('error');
    } else {
      setValidationState('success');
    }
  }, [currentSettings, localAccessToken, localChatId]);

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
        } else {
          // If no specific target handle, use a default mapping
          inputs['message'] = outputs[edge.sourceHandle || 'output'] || '';
        }
      }
    }
    
    return inputs;
  };
  
  // Handle node execution
  const handleExecute = useCallback(async () => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    
    try {
      console.log('📤 Starting Telegram message send execution for node:', id);
      
      // Collect inputs from connected nodes
      const inputs = await collectInputsFromConnectedNodes();
      console.log('📥 Collected inputs:', inputs);
      
      // Prepare the execution context
      const executionContext = {
        nodeId: id,
        nodeType: nodeType?.id || 'telegram_message_action',
        inputs: inputs,
        settings: {
          access_token: currentSettings.access_token || localAccessToken,
          chat_id: currentSettings.chat_id || localChatId,
          ...currentSettings
        },
        flowId: flowId
      };
      
      console.log('🚀 Executing Telegram message send with context:', executionContext);
      
      // Execute the node via the modular service
      const result = await nodeService.execution.executeNode(
        Number(flowId), // Ensure flowId is a number
        id, 
        executionContext.inputs
      );
      console.log('✅ Telegram message send execution completed:', result);
      
    } catch (error: any) {
      console.error('❌ Telegram message send execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [id, nodeType, currentSettings, localAccessToken, localChatId, flowId, isExecuting, collectInputsFromConnectedNodes]);
  
  // Settings handlers
  const handleSettingsClick = useCallback(() => {
    setSettingsOpen(true);
  }, []);
  
  const handleSettingsSave = useCallback(() => {
    if (nodeData.onNodeUpdate) {
      nodeData.onNodeUpdate(id, {
        data: {
          settings: {
            ...currentSettings,
            access_token: localAccessToken,
            chat_id: localChatId
          },
          inputs: instance?.data?.inputs || {}
        }
      });
    }
    setSettingsOpen(false);
  }, [nodeData, id, currentSettings, localAccessToken, localChatId, instance?.data?.inputs]);
  
  const handleSettingsCancel = useCallback(() => {
    setLocalAccessToken(currentSettings.access_token || '');
    setLocalChatId(currentSettings.chat_id || '');
    setSettingsOpen(false);
  }, [currentSettings]);
  
  // Custom content rendered below the container
  const customContent = (
    <Box>
      {/* Execution Data Display */}
      {executionData.hasFreshResults && (
        <Box sx={{ mt: 1 }}>
          {executionData.isSuccess ? (
            <Alert severity="success" sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon fontSize="small" />
                <Typography variant="body2">
                  Message sent successfully
                </Typography>
              </Box>
            </Alert>
          ) : (
            <Alert severity="error" sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorIcon fontSize="small" />
                <Typography variant="body2">
                  {executionData.isError ? 'Execution failed' : 'Execution failed'}
                </Typography>
              </Box>
            </Alert>
          )}
          
          {/* Display execution details */}
          {executionData.displayData && (
            <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Last execution: {new Date(executionData.lastExecuted || '').toLocaleString()}
              </Typography>
              {executionData.displayData.inputText && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Message: {executionData.displayData.inputText}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
  
  return (
    <>
      <CompactNodeContainer
        {...props}
        customColorName="electric"
        onCustomExecute={handleExecute}
      />
      
      {/* Custom content with status indicators */}
      {customContent}

      {/* Settings Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={handleSettingsCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TelegramLogo size={24} />
            Telegram Message Action Settings
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Bot Access Token"
              value={localAccessToken}
              onChange={(e) => setLocalAccessToken(e.target.value)}
              placeholder="Enter your Telegram bot token"
              helperText="Optional: Leave empty to use token from Telegram Input node"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Chat ID"
              value={localChatId}
              onChange={(e) => setLocalChatId(e.target.value)}
              placeholder="Enter chat ID (e.g., -1001234567890)"
              helperText="Optional: Leave empty to use chat ID from Telegram Input node"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSettingsSave}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
