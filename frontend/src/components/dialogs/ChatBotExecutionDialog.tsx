import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Chip,
  CircularProgress,
  Tooltip,
  Slide,
  Fade
} from '@mui/material';
import {
  Send as SendIcon,
  Mic as MicIcon,
  Stop as StopIcon,
  PlayArrow as PlayIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useSnackbar } from '../SnackbarProvider';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: Date;
  isProcessing?: boolean;
}

interface ChatBotExecutionDialogProps {
  open: boolean;
  onClose: () => void;
  flowName: string;
  triggerNodeId: string | null;
  triggerNodeType: string | null;
  onExecute: (triggerInputs: Record<string, any>) => Promise<void>;
}

const EXECUTION_TIMEOUT_MS = 30000; // 30 seconds

export const ChatBotExecutionDialog: React.FC<ChatBotExecutionDialogProps> = ({
  open,
  onClose,
  flowName,
  triggerNodeId,
  triggerNodeType,
  onExecute
}) => {
  const { showSnackbar } = useSnackbar();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      type: 'bot',
      content: 'Hi there! How can I help?',
      timestamp: new Date()
    }
  ]);
  
  // Set initial welcome message based on trigger node type
  useEffect(() => {
    if (triggerNodeType === 'chat_input') {
      setMessages([
        {
          id: 'welcome',
          type: 'bot',
          content: 'Hi there! Please type your message to continue.',
          timestamp: new Date()
        }
      ]);
    } else if (triggerNodeType === 'voice_input') {
      setMessages([
        {
          id: 'welcome',
          type: 'bot',
          content: 'Hi there! Please click the microphone button to record your voice message.',
          timestamp: new Date()
        }
      ]);
    }
  }, [triggerNodeType]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Voice recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Use ReturnType<typeof setInterval> to be compatible with both browser and Node typings
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, []);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  };

  const updateMessage = (id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  };

  // Wrap an execution promise with a timeout guard
  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = EXECUTION_TIMEOUT_MS): Promise<T> => {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Execution timed out')), timeoutMs))
    ]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage = inputText.trim();
    setInputText('');

    // Add user message
    addMessage({
      type: 'user',
      content: userMessage
    });

    // Add processing message
    const processingId = addMessage({
      type: 'system',
      content: 'Process Flow',
      isProcessing: true
    });

    try {
      setIsProcessing(true);

      // Execute the flow with timeout guard
      await withTimeout(onExecute({
        user_input: userMessage
      }));

      // Update processing message to success
      updateMessage(processingId, {
        type: 'bot',
        content: 'Hello! How can I assist you today?',
        isProcessing: false
      });

      showSnackbar({
        message: 'Flow executed successfully!',
        severity: 'success',
      });

    } catch (error: any) {
      console.error('Flow execution failed:', error);
      
      // Update processing message to error
      updateMessage(processingId, {
        type: 'bot',
        content: error?.message === 'Execution timed out' 
          ? 'Processing is taking longer than expected. Please try again later.'
          : 'Sorry, there was an error processing your request. Please try again.',
        isProcessing: false
      });

      showSnackbar({
        message: `Flow execution failed: ${error?.message || 'Unknown error'}`,
        severity: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        
        // Add voice message
        addMessage({
          type: 'user',
          content: '🎤 Voice message'
        });

        // Process voice input
        const processingId = addMessage({
          type: 'system',
          content: 'Process Flow',
          isProcessing: true
        });

        try {
          setIsProcessing(true);
          
          // Convert to base64
          const reader = new FileReader();
          const audioData = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });

          await withTimeout(
            onExecute({
              voice_data: audioData
            })
          );

          updateMessage(processingId, {
            type: 'bot',
            content: 'Hello! How can I assist you today?',
            isProcessing: false
          });

        } catch (error: any) {
          updateMessage(processingId, {
            type: 'bot',
            content: error?.message === 'Execution timed out'
              ? 'Voice processing timed out. Please try again.'
              : 'Sorry, I couldn\'t process your voice message. Please try again.',
            isProcessing: false
          });
        } finally {
          setIsProcessing(false);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      showSnackbar({
        message: 'Could not access microphone. Please check permissions.',
        severity: 'error',
      });
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';

    if (isSystem) {
      return (
        <Box
          key={message.id}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: 2
          }}
        >
          <Chip
            icon={message.isProcessing ? <CircularProgress size={14} sx={{ color: '#4CAF50' }} /> : <PlayIcon sx={{ fontSize: 14 }} />}
            label={message.content}
            variant="outlined"
            sx={{
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              borderColor: '#4CAF50',
              color: '#4CAF50',
              fontSize: '12px',
              height: '28px',
              '& .MuiChip-icon': {
                color: '#4CAF50'
              }
            }}
          />
        </Box>
      );
    }

    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          mb: 2.5,
          flexDirection: isUser ? 'row-reverse' : 'row'
        }}
      >
        {!isUser && (
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: '#4CAF50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 1.5,
              flexShrink: 0
            }}
          >
            <BotIcon sx={{ fontSize: 16, color: 'white' }} />
          </Box>
        )}
        
        <Box
          sx={{
            maxWidth: '75%',
            backgroundColor: isUser ? '#007bff' : '#333',
            color: isUser ? '#ffffff' : '#e0e0e0',
            borderRadius: 3,
            px: 2,
            py: 1.5,
            wordWrap: 'break-word',
            overflow: 'hidden',
            border: isUser ? 'none' : '1px solid #444',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
          }}
        >
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 'normal', 
              fontSize: '14px',
              lineHeight: 1.4,
              color: 'inherit'
            }}
          >
            {message.content}
          </Typography>
        </Box>

        {isUser && (
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ml: 1.5,
              flexShrink: 0
            }}
          >
            <PersonIcon sx={{ fontSize: 16, color: 'white' }} />
          </Box>
        )}
      </Box>
    );
  };

  if (!open) return null;

  return (
    <Slide direction="left" in={open} mountOnEnter unmountOnExit>
      <Paper
        elevation={24}
        sx={{
          position: 'fixed',
          right: 16,
          top: 20,
          width: 380,
          height: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1300,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333'
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2.5,
            backgroundColor: '#2d2d2d',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #404040'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#4CAF50',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 2
              }}
            >
              <BotIcon sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {flowName}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ 
              color: '#999',
              '&:hover': {
                color: '#fff',
                backgroundColor: 'rgba(255,255,255,0.1)'
              }
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Messages */}
        <Box
          sx={{
            flexGrow: 1,
            p: 2,
            overflowY: 'auto',
            backgroundColor: '#1a1a1a',
            margin: '0px',
            borderRadius: 0,
            '&::-webkit-scrollbar': {
              width: '6px'
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: '#2d2d2d'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#555',
              borderRadius: '3px'
            }
          }}
        >
          {messages.map(renderMessage)}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input Area */}
        <Box
          sx={{
            p: 2,
            backgroundColor: '#2d2d2d',
            borderTop: '1px solid #404040'
          }}
        >
          {/* Recording indicator */}
          {isRecording && (
            <Fade in={isRecording}>
              <Box
                sx={{
                  mb: 2,
                  p: 1.5,
                  backgroundColor: '#ff4444',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  boxShadow: '0 2px 8px rgba(255,68,68,0.3)'
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    animation: 'pulse 1s infinite'
                  }}
                />
                <Typography variant="body2" color="white" fontWeight="medium" fontSize="13px">
                  Recording... {formatTime(recordingTime)}
                </Typography>
              </Box>
            </Fade>
          )}

          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5 }}>
            {/* Voice input button - only show for voice_input node type */}
            {triggerNodeType === 'voice_input' && (
              <>
                <Box 
                  sx={{ 
                    flexGrow: 1, 
                    backgroundColor: '#404040',
                    borderRadius: 3,
                    px: 2,
                    py: 1.5,
                    color: '#aaa',
                    fontSize: '14px',
                    border: '1px solid #555',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isRecording ? 'Recording voice message...' : 'Click the microphone button to start recording'}
                </Box>
                <Tooltip title={isRecording ? "Stop recording" : "Start voice recording"}>
                  <IconButton
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    disabled={isProcessing}
                    sx={{
                      backgroundColor: isRecording ? '#ff4444' : '#4CAF50',
                      color: 'white',
                      width: 44,
                      height: 44,
                      '&:hover': {
                        backgroundColor: isRecording ? '#ff3333' : '#45a049'
                      },
                      '&:disabled': {
                        backgroundColor: '#666',
                        color: '#999'
                      },
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      mb: 0.5
                    }}
                  >
                    {isRecording ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </>
            )}

            {/* Text input field - only show for chat_input node type */}
            {triggerNodeType === 'chat_input' && (
              <>
                <TextField
                  ref={inputRef}
                  fullWidth
                  multiline
                  maxRows={4}
                  placeholder="Type your question..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isProcessing}
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      backgroundColor: '#404040',
                      '& fieldset': {
                        borderColor: '#555',
                        borderWidth: '1px'
                      },
                      '&:hover fieldset': {
                        borderColor: '#777',
                        borderWidth: '1px'
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#007bff',
                        borderWidth: '2px'
                      }
                    },
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
                      fontSize: '14px',
                      padding: '12px 16px',
                      lineHeight: 1.4
                    },
                    '& .MuiInputBase-input::placeholder': {
                      color: '#aaa',
                      opacity: 1
                    },
                    '& .Mui-disabled': {
                      opacity: 0.6,
                      '& .MuiInputBase-input': {
                        color: '#888'
                      }
                    }
                  }}
                />

                <Tooltip title="Send message">
                  <IconButton
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || isProcessing}
                    sx={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      width: 44,
                      height: 44,
                      '&:hover': {
                        backgroundColor: '#0056b3'
                      },
                      '&:disabled': {
                        backgroundColor: '#666',
                        color: '#999'
                      },
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      mb: 0.5
                    }}
                  >
                    <SendIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>
      </Paper>
    </Slide>
  );
};
