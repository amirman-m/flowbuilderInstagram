import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Alert,
  Button,
  TextField,
  Paper,
  CircularProgress,
  MenuItem,
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
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [botName, setBotName] = useState<string>('telegram');
  const [accessToken, setAccessToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [validationStatus, setValidationStatus] = useState<'none' | 'success' | 'error'>('none');
  const [isFetchingConfigs, setIsFetchingConfigs] = useState(false);
  const [existingConfigs, setExistingConfigs] = useState<{ config_name: string; bot_username?: string | null }[]>([]);
  const [selectedExistingName, setSelectedExistingName] = useState<string>('');

  // SSE connection reference
  const eventSourceRef = useRef<EventSource | null>(null);

  const nodeData = data as NodeDataWithHandlers;
  const { instance, onNodeUpdate, onExecutionComplete, flowId } = nodeData;

  // Use execution data hook to get fresh execution results
  const executionData = useExecutionData(nodeData);

  // Get current settings from instance data
  const currentSettings = instance.data?.settings || {};

  // Initialize access token from settings
  useEffect(() => {
    if (currentSettings.access_token) {
      setAccessToken(currentSettings.access_token);
    }
    if (currentSettings.config_name) {
      setBotName(currentSettings.config_name);
    }
  }, [currentSettings.access_token]);

  // Fetch existing configs when dialog opens
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        setIsFetchingConfigs(true);
        const res = await fetch(`${API_BASE_URL}/telegram-bot/configs`);
        if (!res.ok) throw new Error(`Failed to load configs (${res.status})`);
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        setExistingConfigs(items.map((i: any) => ({
          config_name: String(i.config_name),
          bot_username: i.bot_username ?? null,
        })));
      } catch (e) {
        console.error('Failed to fetch Telegram bot configs', e);
      } finally {
        setIsFetchingConfigs(false);
      }
    };
    if (settingsDialogOpen) fetchConfigs();
  }, [settingsDialogOpen]);

  // Settings handlers
  const closeSettingsDialog = () => {
    setSettingsDialogOpen(false);
    setValidationStatus('none');
    setValidationMessage('');
  };
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
    setBotName('telegram');
    setSelectedExistingName('');
    updateSettings({ access_token: '', config_name: 'telegram' });
    setValidationStatus('none');
    setValidationMessage('');
  };

  // Validate bot token using new API
  const validateBotToken = async (token: string): Promise<boolean> => {
    if (!token || token.trim() === '') {
      setValidationStatus('error');
      setValidationMessage('Please enter a bot token');
      return false;
    }

    setIsValidating(true);
    setValidationStatus('none');
    setValidationMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/telegram-bot/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: token
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setValidationStatus('success');
        setValidationMessage(result.message);
        return true;
      } else {
        setValidationStatus('error');
        setValidationMessage(result.message);
        return false;
      }
    } catch (error) {
      console.error('Error validating bot token:', error);
      setValidationStatus('error');
      setValidationMessage('Failed to validate bot token. Please check your connection.');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // Guard before execution: ensure access token exists and is valid
  const handleBeforeExecute = async (): Promise<boolean> => {
    // If using existing config, no need to validate token client-side
    if (selectedExistingName) return true;
    const token = (instance?.data?.settings as any)?.access_token || accessToken;
    if (!token || String(token).trim() === '') {
      openSettingsDialog();
      return false;
    }

    // Validate token before proceeding
    return await validateBotToken(token);
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
            
            // Normalize outputs under message_data for useExecutionData compatibility
            const outputs = {
              message_data: {
                input_text: msgData.input_text || msgData.chat_input,
                chat_id: msgData.chat_id,
                input_type: msgData.input_type || 'text',
                user_data: msgData.user_data || {},
                timestamp: msgData.timestamp || new Date().toISOString()
              }
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

            {/* Existing config selector */}
            <TextField
              select
              fullWidth
              label="Use Existing Bot"
              value={selectedExistingName}
              onChange={(e) => {
                const val = e.target.value as string;
                setSelectedExistingName(val);
                if (val) {
                  // When selecting existing, mirror its name into botName for clarity
                  setBotName(val);
                }
              }}
              sx={{ mb: 2 }}
              helperText={isFetchingConfigs ? 'Loading existing bots...' : (existingConfigs.length ? 'Select an existing bot to reuse' : 'No saved bots yet')}
              InputProps={{ endAdornment: isFetchingConfigs ? <CircularProgress size={18} /> : undefined }}
            >
              <MenuItem value="">Create new</MenuItem>
              {existingConfigs.map((cfg) => (
                <MenuItem key={cfg.config_name} value={cfg.config_name}>
                  {cfg.config_name}{cfg.bot_username ? ` (${cfg.bot_username})` : ''}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Bot Name"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Enter a friendly name (e.g., marketing-bot)"
              sx={{ mb: 2 }}
              helperText="This name helps you reuse the same bot across flows"
              disabled={!!selectedExistingName}
            />

            <TextField
              fullWidth
              label="Bot Access Token"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Enter your Telegram bot token"
              sx={{ mb: 2 }}
              helperText="Get your bot token from @BotFather on Telegram"
              error={validationStatus === 'error'}
              disabled={!!selectedExistingName}
            />

            {/* Validation feedback */}
            {validationMessage && (
              <Alert
                severity={validationStatus === 'success' ? 'success' : 'error'}
                sx={{ mb: 2 }}
              >
                {validationMessage}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button onClick={resetSettings} color="error">
                Reset
              </Button>
              <Button onClick={closeSettingsDialog} variant="outlined">
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  // If using existing, skip validation and call setup with name only
                  const usingExisting = !!selectedExistingName;
                  const proceed = usingExisting ? true : await validateBotToken(accessToken);
                  if (proceed) {
                    try {
                      // Persist local node settings snapshot (for UI only)
                      if (usingExisting) {
                        updateSettings({ access_token: '', config_name: selectedExistingName });
                      } else {
                        updateSettings({ access_token: accessToken, config_name: (botName && botName.trim()) ? botName.trim() : 'telegram' });
                      }

                      // Immediately set up webhook (backend will check current status first)
                      const response = await fetch(`${API_BASE_URL}/telegram-bot/setup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(usingExisting ? {
                          access_token: null,
                          flow_id: parseInt(flowId || '1'),
                          node_id: id,
                          config_name: selectedExistingName
                        } : {
                          access_token: accessToken,
                          flow_id: parseInt(flowId || '1'),
                          node_id: id,
                          config_name: (botName && botName.trim()) ? botName.trim() : 'telegram'
                        })
                      });

                      if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`Setup failed (${response.status}): ${errText}`);
                      }

                      const result = await response.json();
                      if (!result.success) {
                        throw new Error(result.message || 'Failed to set up Telegram webhook');
                      }

                      // Reflect configured status in node data
                      if (onNodeUpdate) {
                        onNodeUpdate(id, {
                          data: {
                            ...instance.data,
                            lastExecution: {
                              timestamp: new Date().toISOString(),
                              status: NodeExecutionStatus.SUCCESS,
                              startedAt: new Date().toISOString(),
                              outputs: {
                                webhook_status: 'configured',
                                bot_config: result.config_data,
                                message: result.message
                              }
                            }
                          }
                        });
                      }

                      // Close dialog on success
                      closeSettingsDialog();
                    } catch (e) {
                      console.error('Webhook setup error:', e);
                      setValidationStatus('error');
                      setValidationMessage(e instanceof Error ? e.message : 'Failed to set up Telegram webhook');
                      return;
                    }
                  }
                }}
                variant="contained"
                disabled={isValidating}
              >
                {isValidating ? 'Validating...' : 'Save'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </>
  );
};
