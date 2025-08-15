// src/components/nodes/node-types/VoiceInputNode.tsx
import React, { useState, useRef } from 'react';
import { 
  Box, Typography, Dialog, 
  Button, Alert, LinearProgress,
  FormControlLabel, Checkbox
} from '@mui/material';
import { 
  Mic as MicIcon, 
  Stop as StopIcon, 
  PlayArrow as PlayIcon, 
  Delete as DeleteIcon, 
  Send as SendIcon,
  CheckCircle as CheckCircleIcon 
} from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { NodeExecutionStatus } from '../../../types/nodes';
import { BaseNode } from '../core/BaseNode';
import { useNodeConfiguration, useExecutionData } from '../hooks';
import { nodeService } from '../../../services/nodeService';
import { useParams } from 'react-router-dom';

export const VoiceInputNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const { flowId } = useParams<{ flowId: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [validationState] = useState<'error' | 'success' | 'none'>('none');
  const [sendToTranscription, setSendToTranscription] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeUpdate } = nodeData;
  
  // Use our new modular hooks
  const nodeConfig = useNodeConfiguration(nodeType?.id || 'voice_input');
  const executionData = useExecutionData(nodeData);
  
  // Get current settings from instance
  const currentSettings = instance?.data?.settings || {};
  const { quality = 'high', format = 'webm' } = currentSettings;
  
  const handleExecute = () => {
    setDialogOpen(true);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      console.log('🎤 Audio stream obtained:', {
        tracks: stream.getAudioTracks().length,
        settings: stream.getAudioTracks()[0]?.getSettings()
      });
      
      // Use a more compatible MIME type - prioritize formats with best browser support
      let mimeType = '';
      const supportedTypes = [
        'audio/webm;codecs=opus', 
        'audio/webm', 
        'audio/mp4', 
        'audio/ogg;codecs=opus',
        'audio/wav',
        'audio/mpeg'
      ];
      
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      // If none of our preferred types are supported, let the browser choose
      if (!mimeType) {
        console.warn('🎤 No preferred MIME types supported, using browser default');
      }
      
      console.log('🎤 Using MIME type:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined
      });
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('🎤 Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalMimeType = mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: finalMimeType });
        setAudioBlob(audioBlob);
        
        // Revoke any previous object URL to prevent memory leaks
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Ensure audio element is updated with the new URL
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load(); // Force reload with new source
        }
        console.log('🎤 Recording completed:', {
          size: audioBlob.size,
          type: audioBlob.type,
          chunks: audioChunks.length,
          url
        });
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => {
          console.log('🎤 Stopping track:', track.kind, track.enabled);
          track.stop();
        });
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playAudio = () => {
    if (audioRef.current && audioUrl) {
      // Ensure audio is loaded before playing
      audioRef.current.load();
      const playPromise = audioRef.current.play();
      
      // Handle play() promise to catch any autoplay restrictions
      if (playPromise !== undefined) {
        playPromise
          .then(() => console.log('🎵 Audio playback started successfully'))
          .catch(error => console.error('🎵 Audio playback failed:', error));
      }
    } else {
      console.warn('🎵 Cannot play: audio reference or URL is missing');
    }
  };

  const deleteRecording = () => {
    // Revoke object URL to prevent memory leaks
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const handleSubmit = async () => {
    if (!audioBlob || !flowId || !id) return;
    
    try {
      setExecuting(true);
      console.log('🚀 Executing Voice Input node via backend API...');
      
      // First, ensure the node is saved to the database
      console.log('💾 Auto-saving flow to ensure node exists in database...');
      try {
        await new Promise((resolve, reject) => {
          const saveFlowEvent = new CustomEvent('autoSaveFlow', {
            detail: { 
              nodeId: id, 
              reason: 'pre-execution',
              callback: (error?: Error) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(null);
                }
              }
            }
          });
          window.dispatchEvent(saveFlowEvent);
        });
        console.log('💾 Auto-save completed');
      } catch (saveError) {
        console.warn('⚠️ Auto-save failed, continuing with execution:', saveError);
      }
      
      // Convert blob to base64 for transmission
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const executionContext = {
        voice_data: base64Audio,
        content_type: audioBlob.type,
        send_to_transcription: sendToTranscription
      };
      
      console.log('🎤 Sending execution context:', {
        voice_data_length: base64Audio.length,
        content_type: audioBlob.type,
        send_to_transcription: sendToTranscription,
        flowId,
        nodeId: id
      });
      
      // Execute the node through the backend
      const result = await nodeService.execution.executeNode(
        parseInt(flowId), 
        id,
        executionContext
      );
      
      console.log('✅ Backend execution result:', result);
      
      // Close dialog and reset
      setDialogOpen(false);
      deleteRecording();
      
      // Update node state with execution results
      if (onNodeUpdate && result) {
        const lastExecution = {
          timestamp: new Date().toISOString(),
          status: result.status || NodeExecutionStatus.SUCCESS,
          outputs: result.outputs || {},
          startedAt: new Date().toISOString()
        };
        
        onNodeUpdate(id, {
          data: {
            ...instance.data,
            lastExecution
          }
        });
        
        console.log('✅ Node state updated with execution results:', lastExecution);
      } else {
        console.warn('⚠️ Could not update node state: onNodeUpdate function not available');
      }
    } catch (error: any) {
      console.error('❌ Backend execution failed:', error);
    } finally {
      setExecuting(false);
    }
  };
  
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    const onNodeDelete = data?.onNodeDelete;
    if (onNodeDelete && id) {
      onNodeDelete(id);
    }
  };

  // Custom content for Voice Input node
  const renderCustomContent = () => (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
        Quality: {quality}
      </Typography>
      <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
        Format: {format}
      </Typography>
      
      {/* Execution Results Display */}
      {executionData.hasFreshResults && executionData.displayData && (
        <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#666' }}>
            Voice Input:
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              mt: 0.5, 
              wordBreak: 'break-word',
              fontSize: '0.75rem',
              lineHeight: 1.3,
              maxHeight: '60px',
              overflow: 'hidden'
            }}
          >
            {executionData.displayData.inputText || 'Voice recorded'}
          </Typography>
          {executionData.lastExecuted && (
            <Typography variant="caption" sx={{ color: '#999', fontSize: '0.7rem' }}>
              {new Date(executionData.lastExecuted).toLocaleTimeString()}
            </Typography>
          )}
          {executionData.displayData.metadata && (
            <Typography variant="caption" sx={{ color: '#999', display: 'block', fontSize: '0.7rem' }}>
              Duration: {executionData.displayData.metadata.duration || 'N/A'}s
            </Typography>
          )}
        </Box>
      )}
      
      {/* Success indicator for processed voice input */}
      {executionData.hasFreshResults && executionData.isSuccess && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">
            Voice input processed successfully
          </Typography>
        </Alert>
      )}
    </Box>
  );

  return (
    <>
      <BaseNode
        {...props}
        nodeTypeId="voice_input"
        nodeConfig={nodeConfig}
        validationState={validationState}
        onExecute={handleExecute}
        customContent={renderCustomContent()}
        icon={<MicIcon />}
      />
      
      {/* Voice Recording Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <Box sx={{ p: 3, width: 400 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Record Voice Input</Typography>
          
          {/* Recording Controls */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            {!isRecording && !audioBlob && (
              <Button
                variant="contained"
                startIcon={<MicIcon />}
                onClick={startRecording}
                sx={{ mr: 1 }}
              >
                Start Recording
              </Button>
            )}
            
            {isRecording && (
              <Button
                variant="contained"
                color="error"
                startIcon={<StopIcon />}
                onClick={stopRecording}
              >
                Stop Recording
              </Button>
            )}
          </Box>
          
          {/* Recording Progress */}
          {isRecording && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>Recording...</Typography>
              <LinearProgress />
            </Box>
          )}
          
          {/* Audio Playback Controls */}
          {audioBlob && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>Recording ready:</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<PlayIcon />}
                  onClick={playAudio}
                >
                  Play
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={deleteRecording}
                >
                  Delete
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<MicIcon />}
                  onClick={startRecording}
                >
                  Re-record
                </Button>
              </Box>
              {/* Visible audio controls for debugging and better UX */}
              <audio 
                ref={audioRef} 
                src={audioUrl || undefined} 
                controls={true}
                preload="auto"
                autoPlay={false}
                onError={(e) => console.error('🎵 Audio element error:', e.currentTarget.error)}
                onLoadedData={() => console.log('🎵 Audio loaded successfully')}
                onCanPlay={() => console.log('🎵 Audio can play')}
                onLoadStart={() => console.log('🎵 Audio load started')}
                onPlay={() => console.log('🎵 Audio playback started')}
                style={{ width: '100%', marginTop: '8px' }} 
              >
                Your browser does not support the audio element.
              </audio>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                You can also use the audio controls above to play/pause
              </Typography>
            </Box>
          )}
          
          {/* Transcription Option */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={sendToTranscription}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSendToTranscription(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2">
                  Send to Transcription Node (if connected)
                </Typography>
              }
            />
          </Box>
          
          {/* Dialog Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              startIcon={<SendIcon />}
              onClick={handleSubmit}
              disabled={!audioBlob || executing}
            >
              {executing ? 'Sending...' : 'Send'}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </>
  );
};
