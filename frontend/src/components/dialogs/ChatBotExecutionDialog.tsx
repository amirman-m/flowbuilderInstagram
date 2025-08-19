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
            icon={message.isProcessing ? <CircularProgress size={16} /> : <PlayIcon />}
            label={message.content}
            variant="outlined"
            color="primary"
            sx={{
              backgroundColor: 'rgba(25, 118, 210, 0.08)',
              '& .MuiChip-icon': {
                color: 'primary.main'
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
          mb: 2,
          flexDirection: isUser ? 'row-reverse' : 'row'
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: isUser ? 'primary.main' : 'grey.300',
            mx: 1
          }}
        >
          {isUser ? <PersonIcon fontSize="small" /> : <BotIcon fontSize="small" />}
        </Avatar>
        
        <Paper
          elevation={1}
          sx={{
            px: 2,
            py: 1,
            maxWidth: '70%',
            backgroundColor: isUser ? '#1976d2' : '#f0f0f0',
            color: isUser ? 'white' : '#000000',
            borderRadius: 2,
            borderTopLeftRadius: isUser ? 2 : 0.5,
            borderTopRightRadius: isUser ? 0.5 : 2,
            border: isUser ? 'none' : '1px solid #e0e0e0'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'normal', fontSize: '14px' }}>
            {message.content}
          </Typography>
        </Paper>
      </Box>
    );
  };

  if (!open) return null;

  return (
    <Slide direction="left" in={open} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          right: 16,
          top: 20,
          width: 400,
          height: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1300,
          borderRadius: 3,
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            backgroundColor: 'primary.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <BotIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              {flowName}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Messages */}
        <Box
          sx={{
            flexGrow: 1,
            p: 2,
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            margin: '8px',
            borderRadius: 2
          }}
        >
          {messages.map(renderMessage)}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input Area */}
        <Box
          sx={{
            p: 2,
            backgroundColor: 'white',
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          {/* Recording indicator - moved to top of input area for better visibility */}
          {isRecording && (
            <Fade in={isRecording}>
              <Box
                sx={{
                  mb: 2,
                  p: 1,
                  backgroundColor: 'error.light',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1
                }}
              >
                <StopIcon fontSize="small" />
                <Typography variant="body2" color="white" fontWeight="medium">
                  Recording... {formatTime(recordingTime)}
                </Typography>
              </Box>
            </Fade>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Voice input button moved to left side */}
            {triggerNodeType === 'voice_input' && (
              <Tooltip title={isRecording ? "Stop recording" : "Start voice recording"}>
                <IconButton
                  color={isRecording ? "error" : "primary"}
                  onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                  disabled={isProcessing}
                  sx={{
                    backgroundColor: isRecording ? 'error.main' : 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: isRecording ? 'error.dark' : 'primary.dark'
                    },
                    minWidth: '40px',
                    height: '40px',
                    boxShadow: '0px 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  {isRecording ? <StopIcon /> : <MicIcon />}
                </IconButton>
              </Tooltip>
            )}

            <TextField
              ref={inputRef}
              fullWidth
              multiline
              maxRows={3}
              placeholder="Type your question..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isProcessing || isRecording}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                  backgroundColor: 'white',
                  '& fieldset': {
                    borderColor: '#e0e0e0',
                    borderWidth: '1px'
                  },
                  '&:hover fieldset': {
                    borderColor: '#1976d2',
                    borderWidth: '1px'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1976d2',
                    borderWidth: '2px'
                  }
                },
                '& .MuiInputBase-input': {
                  color: '#000000 !important',
                  backgroundColor: 'white !important',
                  fontWeight: 'normal',
                  fontSize: '14px',
                  padding: '12px 14px'
                },
                '& .MuiInputBase-input::placeholder': {
                  color: '#666666',
                  opacity: 1
                },
                '& .Mui-disabled': {
                  opacity: 0.7,
                  backgroundColor: '#f5f5f5 !important'
                }
              }}
            />

            <Tooltip title="Send message">
              <IconButton
                color="primary"
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isProcessing || isRecording}
                sx={{
                  backgroundColor: '#1976d2',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#1565c0'
                  },
                  '&:disabled': {
                    backgroundColor: '#cccccc !important',
                    color: '#666666 !important'
                  },
                  minWidth: '40px',
                  height: '40px',
                  boxShadow: '0px 2px 4px rgba(0,0,0,0.2)',
                  marginBottom: '0px'
                }}
              >
                <SendIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>
    </Slide>
  );
};
