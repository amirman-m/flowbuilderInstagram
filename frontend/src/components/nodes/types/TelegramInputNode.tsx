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
import { NodeExecutionStatus } from '../../../types/nodes';
import { useExecutionData } from '../hooks/useExecutionData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const TelegramInputNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const [settingsValidationState, setSettingsValidationState] = useState<'error' | 'success' | 'none'>('none');
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  
  // SSE connection reference
  const eventSourceRef = useRef<EventSource | null>(null);

  const nodeData = data as NodeDataWithHandlers;
  const { instance, onNodeUpdate, flowId } = nodeData;

  // Use execution data hook to get fresh execution results
  const executionData = useExecutionData(nodeData);

  // Get current settings from instance data
  const currentSettings = instance.data?.settings || {};

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
    setSettingsValidationState('none');
    updateSettings({ access_token: '' });
  };

  // Validate settings whenever access token changes
  useEffect(() => {
    const validateToken = (token: string) => {
      if (!token || token.trim().length === 0) {
        return 'error';
      }
      
      // Basic Telegram bot token format validation
      const telegramTokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
      if (!telegramTokenPattern.test(token)) {
        return 'error';
      }
      
      return 'success';
    };
    
    const validationResult = validateToken(accessToken);
    setSettingsValidationState(validationResult);
  }, [currentSettings, accessToken]);

  // Execute handler for BaseNode
  const handleExecute = async () => {
    if (settingsValidationState !== 'success') {
      setErrorMessage('Node is not properly configured. Please check settings.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsExecuting(true);

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

      setStatusMessage('Webhook activated - listening for messages...');
      startListening();
    } catch (error) {
      console.error('Error setting up webhook:', error);
      setErrorMessage(`Error setting up webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
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
        setStatusMessage('Connected - waiting for Telegram messages...');
      };

      eventSource.onmessage = (event) => {
        try {
          const messageData = JSON.parse(event.data);
          
          if (messageData.type === 'webhook_ready') {
            setStatusMessage('Webhook ready - send a message to your Telegram bot');
          } else if (messageData.type === 'telegram_message') {
            setStatusMessage(`Message received: "${messageData.text}" from chat ${messageData.chat_id}`);
            
            // Update node with execution results
            const lastExecution = {
              timestamp: new Date().toISOString(),
              status: NodeExecutionStatus.SUCCESS,
              startedAt: new Date().toISOString(),
              outputs: {
                input_text: messageData.text,
                chat_id: messageData.chat_id,
                input_type: messageData.input_type || 'text',
                user_data: messageData.user_data || {}
              }
            };
            
            if (onNodeUpdate) {
              onNodeUpdate(id, {
                data: {
                  ...instance.data,
                  lastExecution
                }
              });
            }
            
            // Close SSE connection after receiving message
            eventSource.close();
          }
        } catch (parseError) {
          console.error('Failed to parse SSE event data:', parseError);
          setErrorMessage('Failed to parse server response');
        }
      };

      eventSource.onerror = () => {
        setErrorMessage('Connection error - please try again');
        eventSource.close();
      };

      // Timeout after 60 seconds
      setTimeout(() => {
        setStatusMessage('Timeout - no messages received');
        eventSource.close();
      }, 60000);

    } catch (error) {
      setErrorMessage(`Failed to start listening: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  const customContent = (
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
      {errorMessage && (
        <Alert 
          severity="error" 
          icon={<ErrorIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">
            {errorMessage}
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
        nodeTypeId="telegram_input"
        onExecute={handleExecute}
        onSettings={openSettingsDialog}
        customContent={customContent}
        executionStatus={isExecuting ? NodeExecutionStatus.RUNNING : undefined}
        validationState={settingsValidationState}
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
