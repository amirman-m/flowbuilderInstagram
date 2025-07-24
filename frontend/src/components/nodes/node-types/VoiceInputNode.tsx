// src/components/nodes/node-types/VoiceInputNode.tsx
import React, { useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Paper, Box, Typography, IconButton, Dialog, 
  Button, Chip, Alert, LinearProgress
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
import { baseNodeStyles, getCategoryColor } from '..';
import { NodeCategory, NodeExecutionStatus } from '../../../types/nodes';
import { nodeService } from '../../../services/nodeService';
import { useParams } from 'react-router-dom';
import { useExecutionData } from '../hooks/useExecutionData';

export const VoiceInputNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
  const { flowId } = useParams<{ flowId: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeUpdate } = nodeData;
  const categoryColor = getCategoryColor(NodeCategory.TRIGGER);
  
  // Use execution data hook to get fresh execution results
  const executionData = useExecutionData(nodeData);
  
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
      
      // Use a more compatible MIME type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Let browser choose
          }
        }
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
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
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

  const playAudio = async () => {
    if (audioUrl && audioRef.current) {
      try {
        console.log('🎵 Playing audio:', audioUrl);
        audioRef.current.currentTime = 0; // Reset to beginning
        await audioRef.current.play();
      } catch (error) {
        console.error('❌ Error playing audio:', error);
        alert('Could not play audio. Please try recording again.');
      }
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob || !flowId || !id) return;
    
    try {
      setExecuting(true);
      console.log('🚀 Executing Voice Input node via backend API...');
      
      // First, ensure the node is saved to the database
      console.log('💾 Auto-saving flow to ensure node exists in database...');
      try {
        // Get current flow state from parent component
        const saveFlowEvent = new CustomEvent('autoSaveFlow', {
          detail: { nodeId: id, reason: 'pre-execution' }
        });
        window.dispatchEvent(saveFlowEvent);
        
        // Wait a moment for save to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('💾 Auto-save completed');
      } catch (saveError) {
        console.warn('⚠️ Auto-save failed, continuing with execution:', saveError);
      }
      
      // Convert blob to base64 for transmission
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const executionContext = {
        voice_data: base64Audio,
        content_type: audioBlob.type
      };
      
      console.log('🎤 Sending execution context:', {
        voice_data_length: base64Audio.length,
        content_type: audioBlob.type,
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
          outputs: result.outputs || {}
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
  
  return (
    <>
      <Paper 
        sx={{
          ...baseNodeStyles,
          borderColor: selected ? categoryColor : `${categoryColor}80`,
          borderWidth: selected ? 3 : 2,
          backgroundColor: selected ? `${categoryColor}10` : 'white'
        }}
      >
        {/* Input Handles */}
        {nodeType.ports.inputs.map((port: any, index: number) => (
          <Handle
            key={port.id}
            type="target"
            position={Position.Left}
            id={port.id}
            style={{
              top: `${20 + (index * 20)}px`,
              backgroundColor: port.required ? categoryColor : '#999'
            }}
          />
        ))}
        
        {/* Node Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ color: categoryColor, mr: 1 }}>
            <MicIcon />
          </Box>
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            {instance.label || "Voice Input"}
          </Typography>
          <IconButton 
            size="small" 
            sx={{ ml: 0.5 }}
            onClick={handleExecute}
          >
            <MicIcon fontSize="small" color="primary" />
          </IconButton>
          <IconButton 
            size="small" 
            sx={{ ml: 0.5 }}
            onClick={handleDelete}
          >
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Box>

        {/* Node Category */}
        <Chip
          label={NodeCategory.TRIGGER}
          size="small"
          sx={{
            backgroundColor: `${categoryColor}20`,
            color: categoryColor,
            fontSize: '0.7rem',
            height: '20px'
          }}
        />
        
        {/* Execution Results Display */}
        {executionData.hasFreshResults && executionData.displayData.type === 'message_data' && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: categoryColor }}>
              Latest Voice Input:
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Voice recording processed
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              {executionData.displayData.metadata?.file_size} bytes • {new Date(executionData.displayData.timestamp).toLocaleTimeString()}
            </Typography>
          </Box>
        )}
        
        {/* Success indicator for fresh execution */}
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
        
        {/* Output Handles */}
        {nodeType.ports.outputs.map((port: any, index: number) => (
          <Handle
            key={port.id}
            type="source"
            position={Position.Right}
            id={port.id}
            style={{
              top: `${20 + (index * 20)}px`,
              backgroundColor: categoryColor
            }}
          />
        ))}
      </Paper>
      
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
                preload="metadata"
                onError={(e) => console.error('🎵 Audio element error:', e)}
                onLoadedData={() => console.log('🎵 Audio loaded successfully')}
                onCanPlay={() => console.log('🎵 Audio can play')}
                onLoadStart={() => console.log('🎵 Audio load started')}
                style={{ width: '100%', marginTop: '8px' }} 
              />
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                You can also use the audio controls above to play/pause
              </Typography>
            </Box>
          )}
          
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
