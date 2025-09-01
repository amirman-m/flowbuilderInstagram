import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks/useExecutionData';
import { NodeExecutionStatus } from '../../../types/nodes';
import { CompactNodeContainer } from '../core/CompactNodeContainer';

const API_BASE_URL = (() => {
  // Use relative URL to avoid Content Security Policy violations
  // This will work with both HTTP and HTTPS
  const apiPath = '/api/v1';
  
  // If VITE_API_URL is set and it's not localhost, use it (for production)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes('localhost')) {
    // Remove trailing slash if present
    const base = envUrl.replace(/\/$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }
  
  // For local development, use relative path
  return apiPath;
})();

export const TelegramInputNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const [hasFlowConfig, setHasFlowConfig] = useState(false);
  const [flowConfigData, setFlowConfigData] = useState<any>(null);
  const [isCheckingConfig, setIsCheckingConfig] = useState(false);

  // SSE connection reference
  const eventSourceRef = useRef<EventSource | null>(null);

  const nodeData = data as NodeDataWithHandlers;
  const { instance, onNodeUpdate, flowId } = nodeData;

  // Use execution data hook to get fresh execution results
  const executionData = useExecutionData(nodeData);


  // Check for flow-level Telegram configuration on mount
  useEffect(() => {
    checkFlowTelegramConfig();
  }, [flowId]);

  // Check if flow has Telegram configuration
  const checkFlowTelegramConfig = async () => {
    if (!flowId) return;
    
    try {
      setIsCheckingConfig(true);
      const response = await fetch(`${API_BASE_URL}/flows/${flowId}/telegram-settings`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setHasFlowConfig(data.has_telegram_config);
        setFlowConfigData(data.config_data);
      } else {
        setHasFlowConfig(false);
        setFlowConfigData(null);
      }
    } catch (error) {
      console.error('Failed to check flow Telegram config:', error);
      setHasFlowConfig(false);
      setFlowConfigData(null);
    } finally {
      setIsCheckingConfig(false);
    }
  };

  // Show settings error message
  const showSettingsError = () => {
    if (onNodeUpdate) {
      onNodeUpdate(id, {
        data: {
          ...instance.data,
          lastExecution: {
            timestamp: new Date().toISOString(),
            status: NodeExecutionStatus.ERROR,
            startedAt: new Date().toISOString(),
            error: 'Please configure Telegram bot in Flow Settings first',
            outputs: {}
          }
        }
      });
    }
  };


  // Guard before execution: ensure flow has Telegram configuration
  const handleBeforeExecute = async (): Promise<boolean> => {
    // Refresh config check
    await checkFlowTelegramConfig();
    
    if (!hasFlowConfig) {
      showSettingsError();
      return false;
    }
    
    return true;
  };

  // Execute handler - shows waiting dialog and starts listening
  const handleExecute = async (): Promise<void> => {
    try {
      // Update node to show "waiting for message" status
      if (onNodeUpdate) {
        onNodeUpdate(id, {
          data: {
            ...instance.data,
            lastExecution: {
              timestamp: new Date().toISOString(),
              status: NodeExecutionStatus.RUNNING,
              startedAt: new Date().toISOString(),
              outputs: {
                webhook_status: 'listening',
                message: 'Waiting for Telegram message... Send a message to your bot.'
              }
            }
          }
        });
      }

      // Start listening immediately
      startListening();
    } catch (error) {
      console.error('Error starting listener:', error);
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
            // Extract message data from SSE event
            const sseOutputs = messageData.outputs || {};
            const msgData = sseOutputs.message_data || {};
            
            // Log the received message data for debugging
            console.log('Received telegram message data:', JSON.stringify(msgData, null, 2));
            
            // Check if this is a voice message and ensure voice_input is present
            if (msgData.input_type === 'voice' && !msgData.voice_input) {
              console.error('Voice message received but voice_input field is missing!');
              
              // Try to reconstruct voice_input from webhook data if available
              if (messageData.webhook_data?.message?.voice) {
                const voiceInfo = messageData.webhook_data.message.voice;
                msgData.voice_input = {
                  file_id: voiceInfo.file_id,
                  file_unique_id: voiceInfo.file_unique_id,
                  duration: voiceInfo.duration,
                  mime_type: voiceInfo.mime_type,
                  file_size: voiceInfo.file_size
                };
                console.log('Reconstructed voice_input from webhook data:', msgData.voice_input);
              }
            }
            
            // Preserve the complete message_data structure
            const outputs = {
              message_data: msgData
            } as Record<string, unknown>;
      
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
          } else if (messageData.type === 'timeout') {
            // Handle timeout
            if (onNodeUpdate) {
              onNodeUpdate(id, {
                data: {
                  ...instance.data,
                  lastExecution: {
                    timestamp: new Date().toISOString(),
                    status: NodeExecutionStatus.ERROR,
                    startedAt: new Date().toISOString(),
                    error: 'Timeout: No message received in 60 seconds',
                    outputs: {}
                  }
                }
              });
            }
            eventSource.close();
          }
        } catch (parseError) {
          console.error('Failed to parse SSE event data:', parseError);
        }
      };

      eventSource.onerror = () => {
        console.error('SSE connection error');
        if (onNodeUpdate) {
          onNodeUpdate(id, {
            data: {
              ...instance.data,
              lastExecution: {
                timestamp: new Date().toISOString(),
                status: NodeExecutionStatus.ERROR,
                startedAt: new Date().toISOString(),
                error: 'Connection error while waiting for message',
                outputs: {}
              }
            }
          });
        }
        eventSource.close();
      };

      // Timeout after 60 seconds
      setTimeout(() => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          console.log('SSE timeout - no messages received');
          if (onNodeUpdate) {
            onNodeUpdate(id, {
              data: {
                ...instance.data,
                lastExecution: {
                  timestamp: new Date().toISOString(),
                  status: NodeExecutionStatus.ERROR,
                  startedAt: new Date().toISOString(),
                  error: 'Timeout: No message received in 60 seconds',
                  outputs: {}
                }
              }
            });
          }
          eventSource.close();
        }
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

  // Custom content for execution display
  const renderCustomContent = () => (
    <>
      {/* Flow Configuration Status */}
      {!isCheckingConfig && (
        <Box sx={{
          mt: 1,
          p: 1,
          backgroundColor: hasFlowConfig ? '#e8f5e8' : '#fff3e0',
          borderRadius: 1,
          border: `1px solid ${hasFlowConfig ? '#4caf50' : '#ff9800'}`
        }}>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#666' }}>
            Configuration:
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.75rem',
              color: hasFlowConfig ? '#2e7d32' : '#e65100',
              display: 'block',
              mt: 0.5,
              fontWeight: 500
            }}
          >
            {hasFlowConfig 
              ? `Bot configured: @${flowConfigData?.bot_username || 'unknown'}`
              : 'No bot configured - use Flow Settings'
            }
          </Typography>
        </Box>
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
            {executionData.status === 'running' ? 'Status:' : 'Last message:'}
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
              if (executionData.status === 'running') {
                return 'Waiting for Telegram message... Send a message to your bot.';
              }
              if ((displayData as any)?.inputType === 'voice') {
                const v = (displayData as any)?.voiceInput || (displayData as any)?.messageData?.voice_input;
                const fileId = typeof v === 'object' ? v?.file_id : undefined;
                return `Voice message received${fileId ? ` • file_id: ${fileId}` : ''}${(displayData as any).chatId ? ` • Chat ID: ${(displayData as any).chatId}` : ''}`;
              }
              if ((displayData as any)?.inputText) {
                return `Text: "${(displayData as any).inputText}"${(displayData as any).chatId ? ` • Chat ID: ${(displayData as any).chatId}` : ''}${(displayData as any).inputType ? ` • Type: ${(displayData as any).inputType}` : ''}`;
              }
              return 'No output data available';
            })()}
          </Typography>
        </Box>
      )}

      {/* Status indicators */}
      {executionData.status === 'running' && (
        <Alert
          severity="info"
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">
            🔄 Listening for Telegram messages... Send a message to your bot.
          </Typography>
        </Alert>
      )}
      
      {/* Success indicator for received messages */}
      {executionData.hasFreshResults && executionData.isSuccess && executionData.status !== 'running' && (
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
      <CompactNodeContainer
        {...props}
        customColorName="electric"
        onBeforeExecute={handleBeforeExecute}
        onCustomExecute={handleExecute}
      />

      {/* Custom content with status indicators */}
      {renderCustomContent()}

    </>
  );
};
