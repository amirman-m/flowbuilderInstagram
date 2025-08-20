import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Alert,
  Button,
  TextField,
  Paper,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { BaseNode } from '../core/BaseNode';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks/useExecutionData';
import { useNodeExecution } from '../hooks/useNodeExecution';
import { NodeExecutionStatus } from '../../../types/nodes';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const TelegramInputNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  
  // SSE connection reference
  const eventSourceRef = useRef<EventSource | null>(null);

  const nodeData = data as NodeDataWithHandlers;
  const { instance, onNodeUpdate, onExecutionComplete, flowId } = nodeData;

  // Use execution data hook to get fresh execution results
  const executionData = useExecutionData(nodeData);

  // Get current settings from instance data
  const currentSettings = instance.data?.settings || {};
  
  // Use centralized execution service
  const {
    status: nodeStatus,
    message: statusMessage,
    isExecuting,
    isReadyForExecution,
    validateSettings
  } = useNodeExecution({
    nodeId: id,
    settings: currentSettings,
    requiredSettings: ['access_token'],
    onNodeUpdate,
    onExecutionComplete
  });

  // Initialize access token from settings
  useEffect(() => {
    if (currentSettings.access_token) {
      setAccessToken(currentSettings.access_token);
    }
  }, [currentSettings.access_token]);

  // Settings handlers
  const closeSettingsDialog = () => setSettingsDialogOpen(false);
  const openSettingsDialog = () => setSettingsDialogOpen(true);
  
  const updateSettings = (newSettings: any) => {
    if (onNodeUpdate) {
      onNodeUpdate(id, {
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

  // Validate settings whenever access token changes
  useEffect(() => {
    validateSettings();
  }, [validateSettings]);

  // Execute handler for BaseNode - uses centralized service
  const handleExecute = async (): Promise<void> => {
    if (!isReadyForExecution) {
      return;
    }

    // Custom execution logic for Telegram webhook setup
    try {
      const response = await fetch(`${API_BASE_URL}/telegram/setup-webhook/${flowId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: currentSettings.access_token
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Start listening after webhook setup
      startListening();
      
      // Update node state manually since this is custom execution
      if (onNodeUpdate) {
        onNodeUpdate(id, {
          data: {
            ...instance.data,
            lastExecution: {
              timestamp: new Date().toISOString(),
              status: NodeExecutionStatus.SUCCESS,
              startedAt: new Date().toISOString(),
              outputs: {
                webhook_status: 'activated',
                message: 'Webhook activated - listening for messages...'
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Error setting up webhook:', error);
      
      // Update node state with error
      if (onNodeUpdate) {
        onNodeUpdate(id, {
          data: {
            ...instance.data,
            lastExecution: {
              timestamp: new Date().toISOString(),
              status: NodeExecutionStatus.ERROR,
              startedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : 'Unknown error',
              outputs: {}
            }
          }
        });
      }
    }
  };

  // Start SSE listening
  const startListening = () => {
    try {
      const eventSource = new EventSource(`${API_BASE_URL}/telegram/listen/${flowId}`, {
        withCredentials: true
      });
      
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connected - waiting for Telegram messages...');
      };

      eventSource.onmessage = (event) => {
        try {
          const messageData = JSON.parse(event.data);
          
          if (messageData.type === 'webhook_ready') {
            console.log('Webhook ready - send a message to your Telegram bot');
          } else if (messageData.type === 'telegram_message') {
            // Update node with execution results using centralized service
            const outputs = {
              input_text: messageData.text,
              chat_id: messageData.chat_id,
              input_type: messageData.input_type || 'text',
              user_data: messageData.user_data || {}
            };
            
            if (onNodeUpdate) {
              onNodeUpdate(id, {
                data: {
                  ...instance.data,
                  lastExecution: {
                    timestamp: new Date().toISOString(),
                    status: NodeExecutionStatus.SUCCESS,
                    startedAt: new Date().toISOString(),
                    outputs
                  }
                }
              });
            }
            
            // Close SSE connection after receiving message
            eventSource.close();
          }
        } catch (parseError) {
          console.error('Failed to parse SSE event data:', parseError);
        }
      };

      eventSource.onerror = () => {
        console.error('SSE connection error');
        eventSource.close();
      };

      // Timeout after 60 seconds
      setTimeout(() => {
        console.log('SSE timeout - no messages received');
        eventSource.close();
      }, 60000);

    } catch (error) {
      console.error(`Failed to start listening: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Custom content for BaseNode
  const renderCustomContent = () => (
    <>
      {/* Status Messages */}
      {statusMessage && (
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block',
            color: statusMessage.includes('Error') ? '#f44336' : 
                   statusMessage.includes('activated') ? '#4caf50' : '#666',
            mb: 1,
            fontSize: '0.75rem'
          }}
        >
          {statusMessage}
        </Typography>
      )}
      
      {/* Error Message */}
      {executionData.isError && executionData.outputs?.error && (
        <Alert 
          severity="error" 
          icon={<ErrorIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">
            {executionData.outputs.error}
          </Typography>
        </Alert>
      )}
      
      {/* Execution Results Display */}
      {executionData.displayData && (
        <Box sx={{ 
          mt: 1, 
          p: 1, 
          backgroundColor: '#f5f5f5', 
          borderRadius: 1,
          border: '1px solid #ddd'
        }}>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#666' }}>
            Last message:
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              fontSize: '0.75rem', 
              color: '#333',
              display: 'block',
              mt: 0.5,
              wordBreak: 'break-word'
            }}
          >
            {(() => {
              const { displayData } = executionData;
              if (displayData.inputText) {
                return `Text: "${displayData.inputText}"${displayData.chatId ? ` • Chat ID: ${displayData.chatId}` : ''}${displayData.inputType ? ` • Type: ${displayData.inputType}` : ''}`;
              }
              return 'No output data available';
            })()}
          </Typography>
        </Box>
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
            {executionData.executionTime && ` in ${executionData.executionTime.toFixed(2)}ms`}
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
            Execution failed: {executionData.outputs?.error || 'Unknown error'}
          </Typography>
        </Alert>
      )}
    </>
  );

  return (
    <>
      <BaseNode
        {...props}
        nodeTypeId="telegram-input"
        nodeConfig={undefined}
        status={nodeStatus}
        statusMessage={statusMessage || (isReadyForExecution ? 'Ready to execute' : 'Configure settings')}
        isExecuting={isExecuting}
        onExecute={() => handleExecute()}
        onSettingsClick={openSettingsDialog}
        customContent={renderCustomContent()}
        icon={<CheckCircleIcon />}
      />

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
              maxWidth: 500,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              Telegram Bot Settings
            </Typography>
            
            <TextField
              fullWidth
              label="Bot Access Token"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Enter your Telegram bot token"
              sx={{ mb: 2 }}
              helperText="Get your bot token from @BotFather on Telegram"
            />
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button onClick={resetSettings} color="error">
                Reset
              </Button>
              <Button onClick={closeSettingsDialog} variant="outlined">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateSettings({ access_token: accessToken });
                  closeSettingsDialog();
                }}
                variant="contained"
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
