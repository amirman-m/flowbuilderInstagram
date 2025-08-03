import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Box, 
  Typography, 
  Button, 
  TextField, 
  Alert, 
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
  Zoom
} from '@mui/material';
import { 
  Delete as DeleteIcon,
  PlayArrow as ExecuteIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { baseNodeStyles, getCategoryColor } from '../styles';
import { NodeCategory } from '../../../types/nodes';
import { API_BASE_URL } from '../../../services/api';
import { useExecutionData } from '../hooks/useExecutionData';

// Telegram Logo SVG Component
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

export const TelegramInputNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
  const [settingsValidationState, setSettingsValidationState] = useState<'error' | 'success' | 'none'>('none');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [isWebhookActive, setIsWebhookActive] = useState(false);
  const [lastPolledTimestamp, setLastPolledTimestamp] = useState<string | null>(null);

  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, flowId } = nodeData;
  const categoryColor = getCategoryColor(NodeCategory.TRIGGER);
  
  // Use execution data hook to get fresh execution results
  const executionData = useExecutionData(nodeData);

  // Get current settings from instance data
  const currentSettings = instance.data?.settings || {};
  
  // Type guard for instance.data
  const instanceData = instance?.data || {};

  // Initialize access token from settings
  useEffect(() => {
    if (currentSettings.access_token) {
      setAccessToken(currentSettings.access_token);
    }
  }, [currentSettings.access_token]);

  // Smart polling mechanism - only active when webhook is set up and waiting for messages
  useEffect(() => {
    // Only poll when webhook is active and we haven't received message data yet
    if (!isWebhookActive || executionData.hasFreshResults) {
      return;
    }

    const pollForWebhookResults = async () => {
      try {
        console.log('🔍 Smart polling for Telegram webhook results - Node ID:', id, 'Flow ID:', flowId);
        
        const response = await fetch(`${API_BASE_URL}/flows/${flowId}/nodes`, {
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          const nodes = await response.json();
          const currentNode = nodes.find((node: any) => node.id === id);
          
          if (currentNode && currentNode.data && currentNode.data.lastExecution) {
            const lastExecution = currentNode.data.lastExecution;
            const executionTimestamp = lastExecution.timestamp;

            // Only update if we have a new execution result (actual message data)
            if (executionTimestamp !== lastPolledTimestamp && 
                lastExecution.outputs && 
                lastExecution.outputs.message_data &&
                lastExecution.outputs.message_data.input_text) {
              
              console.log('🎉 NEW TELEGRAM MESSAGE RECEIVED!');
              console.log('Message data:', lastExecution.outputs.message_data);

              // Update the node state with the execution results
              if (nodeData.onNodeUpdate) {
                const updateData = {
                  data: {
                    ...instanceData,
                    lastExecution: {
                      status: 'success',
                      timestamp: executionTimestamp,
                      outputs: lastExecution.outputs,
                      executionTime: lastExecution.executionTime || 0
                    }
                  }
                };

                console.log('🔄 Updating node with message data:', updateData);
                nodeData.onNodeUpdate(id, updateData);

                // Stop polling - we got the message data!
                setIsWebhookActive(false);
                setExecutionResult(`Message received: "${lastExecution.outputs.message_data.input_text}"`);
                
                console.log('✅ Telegram message processed and polling stopped');
              }

              setLastPolledTimestamp(executionTimestamp);
            }
          }
        } else {
          console.error('❌ Failed to fetch nodes:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ Failed to poll for webhook results:', error);
      }
    };

    // Poll every 3 seconds when webhook is active
    const pollInterval = setInterval(pollForWebhookResults, 3000);
    
    // Initial poll
    pollForWebhookResults();

    return () => clearInterval(pollInterval);
  }, [isWebhookActive, flowId, id, lastPolledTimestamp, executionData.hasFreshResults, nodeData.onNodeUpdate, instanceData]);

  // Settings handlers
  const closeSettingsDialog = () => setSettingsDialogOpen(false);
  
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
  
  const resetSettings = () => {
    setAccessToken('');
    updateSettings({ access_token: '' });
  };

  // Validate settings whenever they change
  useEffect(() => {
    const token = currentSettings?.access_token || accessToken;
    
    if (!token || token.trim() === '') {
      setSettingsValidationState('error');
    } else if (token.length < 10) {
      setSettingsValidationState('error');
    } else {
      setSettingsValidationState('success');
    }
  }, [currentSettings, accessToken]);

  // Handle node deletion
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (nodeData.onNodeDelete) {
      nodeData.onNodeDelete(id);
    }
  };

  // Handle node execution - DeepSeek style direct execution
  const handleExecute = async (event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Clear previous results
    setExecutionResult(null);
    setExecutionError(null);
    
    // Validate settings
    if (settingsValidationState !== 'success') {
      setExecutionError('Node is not properly configured. Please check bot access token.');
      return;
    }
    
    setIsExecuting(true);
    
    try {
      // Prepare execution context - similar to DeepSeek
      const executionContext = {
        nodeId: id,
        nodeTypeId: nodeType.id,
        inputs: {}, // Telegram trigger has no inputs
        settings: currentSettings
      };
      
      console.log('🚀 Telegram Node - Executing with context:', executionContext);
      
      // Use same API pattern as DeepSeek
      const response = await fetch(`${API_BASE_URL}/nodes/execute/${executionContext.nodeTypeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(executionContext),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to execute node');
      }
      
      const result = await response.json();
      console.log('✅ Telegram Node - Execution Result:', result);
      
      // Update the node instance with execution results - same as DeepSeek
      if (nodeData.onNodeUpdate) {
        nodeData.onNodeUpdate(id, {
          data: {
            ...instanceData,
            lastExecution: {
              status: 'success',
              timestamp: new Date().toISOString(),
              inputs: {},
              outputs: result.outputs,
              logs: result.logs
            }
          }
        });
      }
      
      // Show success message and activate smart polling
      setExecutionResult(result.logs?.[0] || 'Webhook activated - waiting for Telegram message');
      
      // Activate smart polling to wait for actual Telegram messages
      setIsWebhookActive(true);
      console.log('🎯 Webhook activated - starting smart polling for messages');
      
    } catch (error) {
      console.error('❌ Telegram Node - Execution Error:', error);
      
      // Update node with error status
      if (nodeData.onNodeUpdate) {
        nodeData.onNodeUpdate(id, {
          data: {
            ...instanceData,
            lastExecution: {
              status: 'error',
              timestamp: new Date().toISOString(),
              error: error instanceof Error ? error.message : String(error)
            }
          }
        });
      }
      
      // Show error message
      setExecutionError(error instanceof Error ? error.message : String(error) || 'An unknown error occurred');
      
    } finally {
      setIsExecuting(false);
    }
  };

  // Get the current border color based on validation state
  const getBorderColor = () => {
    if (settingsValidationState === 'error') return '#f44336'; // Red for error
    return selected ? categoryColor : `${categoryColor}80`; // Default
  };

  const getBackgroundColor = () => {
    if (settingsValidationState === 'error') return '#ffebee'; // Light red
    return selected ? `${categoryColor}10` : 'white'; // Default
  };

  // Check if node is ready for execution
  const isReadyForExecution = settingsValidationState === 'success';

  return (
    <>
      <Paper 
        sx={{
          ...baseNodeStyles,
          borderColor: getBorderColor(),
          borderWidth: selected ? 3 : 2,
          backgroundColor: getBackgroundColor(),
          position: 'relative',
          transition: 'all 0.3s ease-in-out',
          animation: settingsValidationState === 'error' ? 'pulse 2s infinite' : 'none',
          '@keyframes pulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(244, 67, 54, 0.7)' },
            '70%': { boxShadow: '0 0 0 10px rgba(244, 67, 54, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(244, 67, 54, 0)' }
          }
        }}
      >
        {/* Input Handles - Telegram triggers have no inputs */}
        
        {/* Warning indicator for missing settings */}
        {settingsValidationState === 'error' && (
          <Box sx={{ position: 'absolute', top: -8, right: -8, zIndex: 1 }}>
            <Zoom in={settingsValidationState === 'error'}>
              <Tooltip title="Bot access token required">
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
            {instance.label || nodeType.name}
          </Typography>
          
          {/* Execute button - only appears when settings are configured */}
          {isReadyForExecution && (
            <Tooltip title={isExecuting ? "Setting up webhook..." : "Setup Webhook & Wait for Message"}>
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
          )}
          
          {/* Delete button */}
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
          {NodeCategory.TRIGGER}
        </Typography>

        {/* Execution Results Display - Show extracted Telegram data */}
        {executionData.hasFreshResults && executionData.displayData.type === 'message_data' && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: categoryColor }}>
              Telegram Message Received:
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
              <strong>Text:</strong> "{executionData.displayData.inputText}"
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              Chat ID: {executionData.displayData.chatId} • Type: {executionData.displayData.inputType} • {new Date(executionData.displayData.timestamp).toLocaleTimeString()}
            </Typography>
            {executionData.displayData.metadata && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                From: @{executionData.displayData.metadata.from_user} • Message ID: {executionData.displayData.metadata.telegram_message_id}
              </Typography>
            )}
          </Box>
        )}

        {/* Status Display */}
        {executionResult && (
          <Alert severity="success" sx={{ mt: 1, fontSize: '0.7rem', py: 0.5 }}>
            {executionResult}
          </Alert>
        )}
        
        {settingsValidationState === 'error' && (
          <Alert severity="warning" sx={{ mt: 1, fontSize: '0.7rem', py: 0.5 }}>
            Configure bot token in settings
          </Alert>
        )}
        
        {/* Success indicator for received messages */}
        {executionData.hasFreshResults && executionData.isSuccess && (
          <Alert 
            severity="success" 
            icon={<CheckCircleIcon />}
            sx={{ mt: 1, fontSize: '0.75rem' }}
          >
            <Typography variant="caption">
              Telegram message processed successfully
            </Typography>
          </Alert>
        )}
        
        {/* Error indicator */}
        {executionData.hasFreshResults && executionData.isError && (
          <Alert 
            severity="error" 
            icon={<ErrorIcon />}
            sx={{ mt: 1, fontSize: '0.75rem' }}
          >
            <Typography variant="caption">
              Execution failed
            </Typography>
          </Alert>
        )}

        {/* Error Display */}
        {executionError && (
          <Alert severity="error" sx={{ mt: 1, fontSize: '0.7rem', py: 0.5 }}>
            {executionError}
          </Alert>
        )}

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="message_data"
          style={{
            background: categoryColor,
            border: '2px solid white',
            width: 12,
            height: 12,
          }}
        />
      </Paper>

      {/* Settings Dialog */}
      {settingsDialogOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={closeSettingsDialog}
        >
          <Paper
            sx={{
              p: 3,
              minWidth: 400,
              maxWidth: 600,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              Telegram Bot Settings
            </Typography>

            <TextField
              fullWidth
              label="Bot Access Token"
              placeholder="Enter your Telegram bot token from @BotFather"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              sx={{ mb: 2 }}
              helperText="Get this token by creating a bot with @BotFather on Telegram"
            />

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Setup Instructions:</strong><br/>
                1. Message @BotFather on Telegram<br/>
                2. Use /newbot command to create a new bot<br/>
                3. Copy the access token and paste it above<br/>
                4. Click "Setup Webhook" to activate the trigger
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button onClick={resetSettings}>Reset</Button>
              <Button onClick={closeSettingsDialog}>Cancel</Button>
              <Button 
                variant="contained" 
                onClick={() => {
                  updateSettings({ access_token: accessToken });
                  closeSettingsDialog();
                }}
                disabled={!accessToken?.trim()}
              >
                Save
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </>
  );
};
