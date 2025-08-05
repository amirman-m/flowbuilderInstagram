import React, { useState, useEffect, useRef } from 'react';
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
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  
  // SSE connection reference
  const eventSourceRef = useRef<EventSource | null>(null);

  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;
  const categoryColor = getCategoryColor(NodeCategory.TRIGGER);

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

  // Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Start listening for Telegram messages using SSE
  const startListening = async (event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (settingsValidationState !== 'success') {
      setErrorMessage('Node is not properly configured. Please check settings.');
      return;
    }

    // Clear previous state
    setStatusMessage(null);
    setErrorMessage(null);
    setIsListening(true);

    try {
      // Start SSE connection directly - backend handles webhook setup
      console.log('🔌 Starting SSE connection for Telegram messages...');
      const eventSource = new EventSource(`${API_BASE_URL}/telegram/listen/1`, {
        withCredentials: true
      });
      
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('✅ SSE connection opened');
        setStatusMessage('Connecting...');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 SSE event received:', data);

          switch (data.type) {
            case 'webhook_ready':
              setStatusMessage(data.message);
              break;
              
            case 'ping':
              // Keepalive ping - just log it
              console.log('🏓 Keepalive ping received');
              break;
              
            case 'telegram_message':
              console.log('🎉 Telegram message received!', data);
              
              if (data.status === 'success' && data.outputs?.message_data) {
                // Handle nested message data structure
                let messageData;
                
                // Check if we have the nested structure
                if (data.outputs.message_data.outputs && data.outputs.message_data.outputs.message_data) {
                  console.log('📦 Detected nested message data structure');
                  messageData = data.outputs.message_data.outputs.message_data;
                } else {
                  // Fallback to direct access
                  messageData = data.outputs.message_data;
                }
                
                console.log('📝 Extracted message data:', messageData);
                
                const inputText = messageData.input_text || messageData.chat_input || 'N/A';
                const chatId = messageData.chat_id || 'N/A';
                setStatusMessage(`📨 Message received! "${inputText}" from chat ${chatId}`);
                setIsListening(false);
                
                // Update node data with execution result - follow ChatInputNode pattern
                if (nodeData.onNodeUpdate) {
                  // Create a simple lastExecution object like ChatInputNode
                  const lastExecution = {
                    timestamp: new Date().toISOString(),
                    status: 'success',
                    outputs: { message_data: messageData }
                  };
                  
                  // Update the node instance with execution results - same pattern as ChatInputNode
                  nodeData.onNodeUpdate(id, {
                    data: {
                      ...instance.data,
                      lastExecution
                    }
                  });
                  
                  console.log('✅ Telegram node state updated with execution results:', lastExecution);
                } else {
                  console.warn('⚠️ Could not update node state: onNodeUpdate function not available');
                }
                
                // Close SSE connection after receiving message
                eventSource.close();
              }
              break;
              
            case 'timeout':
              console.log('⏰ Timeout received');
              setErrorMessage(data.message);
              setIsListening(false);
              eventSource.close();
              break;
              
            case 'error':
              console.error('❌ Error received:', data.message);
              setErrorMessage(data.message);
              setIsListening(false);
              eventSource.close();
              break;
              
            default:
              console.log('📄 Unknown SSE event type:', data.type);
          }
        } catch (parseError) {
          console.error('Failed to parse SSE event data:', parseError);
          setErrorMessage('Failed to parse server response');
        }
      };

      eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        setErrorMessage('Connection error - please try again');
        setIsListening(false);
        eventSource.close();
      };

    } catch (error) {
      console.error('❌ Failed to start SSE connection:', error);
      setErrorMessage(`Failed to start listening: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsListening(false);
    }
  };

  // Stop listening
  const stopListening = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsListening(false);
    setStatusMessage(null);
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
            <Tooltip title={isListening ? "Listening for messages..." : "Start Listening for Telegram Messages"}>
              <IconButton 
                size="small" 
                onClick={isListening ? stopListening : startListening} 
                sx={{ ml: 0.5 }}
                disabled={false}
              >
                {isListening ? (
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

        {/* Execution Results Display */}
        {executionData.hasFreshResults && executionData.displayData.type === 'message_data' && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: categoryColor }}>
              Telegram Message:
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
              {executionData.displayData.inputText}
            </Typography>
            
            {/* Message metadata */}
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              Text: '{executionData.displayData.inputText}' • Chat ID: {executionData.displayData.chatId} • Type: {executionData.displayData.inputType}
            </Typography>
            
            {/* User metadata */}
            {executionData.displayData.metadata && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                👤 From: @{executionData.displayData.metadata.from_user || 'unknown'} • 
                🆔 Message ID: {executionData.displayData.metadata.telegram_message_id} • 
                💬 Chat Type: {executionData.displayData.metadata.chat_type || 'private'}
              </Typography>
            )}
            
            {/* Execution timing information */}
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              ⏱️ Execution time: {executionData.executionTime ? `${executionData.executionTime.toFixed(2)}ms` : 'N/A'} • 
              🕒 {executionData.lastExecuted ? new Date(executionData.lastExecuted).toLocaleTimeString() : new Date(executionData.displayData.timestamp).toLocaleTimeString()}
            </Typography>
          </Box>
        )}

        {/* Status Display */}
        {statusMessage && (
          <Alert severity="info" sx={{ mt: 1, fontSize: '0.7rem', py: 0.5 }}>
            {statusMessage}
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
              Execution failed
            </Typography>
          </Alert>
        )}

        {/* Error Display */}
        {errorMessage && (
          <Alert severity="error" sx={{ mt: 1, fontSize: '0.7rem', py: 0.5 }}>
            {errorMessage}
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
