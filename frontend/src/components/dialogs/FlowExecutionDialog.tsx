import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  LinearProgress
} from '@mui/material';
import { 
  PlayArrow as PlayIcon, 
  CheckCircle as CheckIcon,
  Mic as MicIcon,
  Stop as StopIcon,
  PlayCircle as PlayCircleIcon,
  Delete as DeleteIcon,
  Pause as PauseIcon
} from '@mui/icons-material';

interface FlowExecutionDialogProps {
  open: boolean;
  onClose: () => void;
  flowName: string;
  triggerNodeId: string | null;
  triggerNodeType: string | null; // Add trigger node type to determine input method
  onExecute: (triggerInputs: Record<string, any>) => Promise<void>;
}

interface ExecutionResult {
  flow_id: number;
  flow_name: string;
  trigger_node_id: string;
  execution_results: Record<string, any>;
  executed_at: string;
  total_nodes_executed: number;
}

export const FlowExecutionDialog: React.FC<FlowExecutionDialogProps> = ({
  open,
  onClose,
  flowName,
  triggerNodeId,
  triggerNodeType,
  onExecute
}) => {
  const [inputText, setInputText] = useState('');
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Refs for media handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);

  // Cleanup function for audio resources
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [audioUrl]);

  const handleSubmit = async () => {
    // Check if we have input based on trigger type
    const hasTextInput = inputText.trim();
    const hasVoiceInput = audioBlob;
    
    if (triggerNodeType === 'voice_input' && !hasVoiceInput) {
      setError('Please record a voice message before executing.');
      return;
    }
    
    if (triggerNodeType === 'chat-input' && !hasTextInput) {
      setError('Please enter a text message before executing.');
      return;
    }

    try {
      setExecuting(true);
      setError(null);
      
      let executionData: Record<string, any>;
      
      if (triggerNodeType === 'voice_input' && audioBlob) {
        // Convert audio blob to base64 for transmission
        const reader = new FileReader();
        const audioData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
        
        executionData = {
          voice_data: audioData
        };
      } else {
        // Text input
        executionData = {
          user_input: inputText.trim()
        };
      }
      
      // Execute the flow with appropriate input
      await onExecute(executionData);

      // Clear input after successful execution
      setInputText('');
      handleDeleteRecording();
      
    } catch (err: any) {
      console.error('Flow execution failed:', err);
      setError(err.response?.data?.detail || err.message || 'Flow execution failed');
    } finally {
      setExecuting(false);
    }
  };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };
  
  const playRecording = () => {
    if (audioUrl && !isPlaying) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };
      
      audio.play();
      setIsPlaying(true);
    }
  };
  
  const pausePlayback = () => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      audioRef.current = null;
    }
  };
  
  const handleDeleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setRecordingTime(0);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const handleClose = () => {
    if (!executing) {
      setInputText('');
      setError(null);
      setExecutionResult(null);
      handleDeleteRecording();
      onClose();
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const renderVoiceInput = () => {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Record a voice message to trigger the flow execution.
        </Typography>
        
        <Paper 
          elevation={1} 
          sx={{ 
            p: 3, 
            textAlign: 'center',
            border: isRecording ? '2px solid #f44336' : '1px solid #e0e0e0',
            backgroundColor: isRecording ? '#ffebee' : 'background.paper'
          }}
        >
          {!audioBlob ? (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {isRecording ? 'Recording...' : 'Ready to Record'}
              </Typography>
              
              {isRecording && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="error">
                    {formatTime(recordingTime)}
                  </Typography>
                  <LinearProgress 
                    variant="indeterminate" 
                    color="error" 
                    sx={{ mt: 1, height: 4, borderRadius: 2 }}
                  />
                </Box>
              )}
              
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                {!isRecording ? (
                  <Tooltip title="Start recording">
                    <IconButton
                      size="large"
                      color="primary"
                      onClick={startRecording}
                      sx={{
                        width: 64,
                        height: 64,
                        border: '2px solid',
                        borderColor: 'primary.main'
                      }}
                    >
                      <MicIcon fontSize="large" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Stop recording">
                    <IconButton
                      size="large"
                      color="error"
                      onClick={stopRecording}
                      sx={{
                        width: 64,
                        height: 64,
                        border: '2px solid',
                        borderColor: 'error.main'
                      }}
                    >
                      <StopIcon fontSize="large" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Recording Ready
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Duration: {formatTime(recordingTime)}
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                <Tooltip title={isPlaying ? "Pause playback" : "Play recording"}>
                  <IconButton
                    color="primary"
                    onClick={isPlaying ? pausePlayback : playRecording}
                  >
                    {isPlaying ? <PauseIcon /> : <PlayCircleIcon />}
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Delete recording">
                  <IconButton
                    color="error"
                    onClick={handleDeleteRecording}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Record new">
                  <IconButton
                    color="primary"
                    onClick={() => {
                      handleDeleteRecording();
                      startRecording();
                    }}
                  >
                    <MicIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>
    );
  };
  
  const renderTextInput = () => {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter a text message to trigger the flow execution.
        </Typography>
        
        <TextField
          fullWidth
          multiline
          rows={4}
          label="Trigger Input"
          placeholder="Enter your message or input for the flow..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={executing}
          sx={{ mb: 2 }}
        />
      </Box>
    );
  };

  const renderExecutionResults = () => {
    if (!executionResult) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">
            Flow executed successfully!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {executionResult.total_nodes_executed} nodes executed at {new Date(executionResult.executed_at).toLocaleString()}
          </Typography>
        </Alert>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Execution Results:
        </Typography>
        
        {Object.entries(executionResult.execution_results).map(([nodeId, result]: [string, any]) => (
          <Box key={nodeId} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CheckIcon color="success" fontSize="small" sx={{ mr: 1 }} />
              <Typography variant="subtitle2">
                Node: {nodeId}
              </Typography>
              <Chip 
                label={result.status || 'completed'} 
                size="small" 
                color={result.status === 'success' ? 'success' : 'default'}
                sx={{ ml: 1 }}
              />
            </Box>
            
            {result.outputs && Object.keys(result.outputs).length > 0 && (
              <Box sx={{ ml: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Outputs: {JSON.stringify(result.outputs, null, 2)}
                </Typography>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <PlayIcon sx={{ mr: 1, color: 'primary.main' }} />
        Execute Flow: {flowName}
      </DialogTitle>
      
      <DialogContent>
        {!executionResult && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This flow will start execution from the trigger node{triggerNodeId ? ` (${triggerNodeId})` : ''}.
              {triggerNodeType === 'voice_input' 
                ? ' Please record a voice message below.' 
                : ' Please provide the input for the trigger node below.'}
            </Typography>

            {triggerNodeType === 'voice_input' ? renderVoiceInput() : renderTextInput()}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
          </>
        )}

        {renderExecutionResults()}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={executing}>
          {executionResult ? 'Close' : 'Cancel'}
        </Button>
        
        {!executionResult && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={
              executing || 
              (triggerNodeType === 'voice_input' ? !audioBlob : !inputText.trim())
            }
            startIcon={executing ? <CircularProgress size={16} /> : <PlayIcon />}
          >
            {executing ? 'Executing Flow...' : 'Execute Flow'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
