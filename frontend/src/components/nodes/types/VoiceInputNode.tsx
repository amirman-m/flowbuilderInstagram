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
import { useNodeConfiguration, useExecutionData } from '../hooks';
import { nodeService } from '../../../services/nodeService';
import { useParams } from 'react-router-dom';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { NodeExecutionManager } from '../core/NodeExecutionManager';
import { NodeResultDisplay } from '../core/NodeResultDisplay';

export const VoiceInputNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const { flowId } = useParams<{ flowId: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeUpdate } = nodeData;

  // Hooks
  const nodeConfig = useNodeConfiguration(nodeType?.id || 'voice_input');
  const executionData = useExecutionData(nodeData);

  // Current settings (optional usage)
  const currentSettings = instance?.data?.settings || {};
  const { quality = 'high', format = 'webm' } = currentSettings as { quality?: string; format?: string };

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

      // Pick a supported MIME type
      let mimeType = '';
      // Prioritize MIME types based on configured `format`, with sensible fallbacks
      const preferredByFormat: Record<string, string[]> = {
        webm: ['audio/webm;codecs=opus', 'audio/webm'],
        mp4: ['audio/mp4'],
        ogg: ['audio/ogg;codecs=opus'],
        wav: ['audio/wav'],
        mp3: ['audio/mpeg'],
      };
      const fallbackTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav',
        'audio/mpeg'
      ];
      const supportedTypes = [
        ...(preferredByFormat[(format || 'webm').toLowerCase()] || []),
        ...fallbackTypes,
      ];
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) { mimeType = type; break; }
      }

      // Map quality setting to bitrate
      const bitrateMap: Record<string, number> = { low: 64000, medium: 128000, high: 192000 };
      const selectedBitrate = bitrateMap[(quality || 'high').toLowerCase()] ?? 128000;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType || undefined, audioBitsPerSecond: selectedBitrate });
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const finalMimeType = mimeType || 'audio/webm';
        const blob = new Blob(audioChunks, { type: finalMimeType });
        setAudioBlob(blob);

        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load();
        }

        // Release mic
        stream.getTracks().forEach(track => track.stop());
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
      audioRef.current.load();
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => console.error('Audio playback failed:', err));
      }
    }
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const handleSubmit = async () => {
    if (!audioBlob || !flowId || !id) return;

    try {
      setIsExecuting(true);
      setStatusMessage('Executing...');

      // Update centralized status
      NodeExecutionManager.getInstance().setStatus(id, NodeExecutionStatus.RUNNING, 'Executing...');

      // Auto-save before execution
      try {
        await new Promise((resolve, reject) => {
          const saveFlowEvent = new CustomEvent('autoSaveFlow', {
            detail: {
              nodeId: id,
              reason: 'pre-execution',
              callback: (error?: Error) => error ? reject(error) : resolve(null)
            }
          });
          window.dispatchEvent(saveFlowEvent);
        });
      } catch (saveError) {
        console.warn('Auto-save failed, continuing:', saveError);
      }

      // Convert blob -> base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const executionContext = {
        voice_data: base64Audio,
        content_type: audioBlob.type,
        send_to_transcription: true
      };

      const result = await nodeService.execution.executeNode(
        parseInt(flowId),
        id,
        executionContext
      );

      // Close dialog and reset local state
      setDialogOpen(false);
      deleteRecording();

      if (result && onNodeUpdate) {
        // Success
        NodeExecutionManager.getInstance().setStatus(id, NodeExecutionStatus.SUCCESS, 'Execution completed successfully');
        setStatusMessage('Execution completed successfully');

        onNodeUpdate(id, {
          data: {
            ...(instance?.data || {}),
            lastExecution: {
              status: NodeExecutionStatus.SUCCESS,
              outputs: result.outputs || {},
              startedAt: new Date().toISOString(),
            },
            outputs: result.outputs || {}
          },
          updatedAt: new Date()
        });
      }
    } catch (error: any) {
      console.error('Backend execution failed:', error);
      NodeExecutionManager.getInstance().setStatus(id, NodeExecutionStatus.ERROR, 'Execution failed');
      setStatusMessage('Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  // Custom content showing latest results
  const customContent = (
    <>
      {(executionData.hasFreshResults || executionData.isExecuted) && (
        <NodeResultDisplay
          title="Voice Input:"
          content={(() => {
            const displayData = executionData.displayData;
            const outputs = executionData.outputs;

            // Prefer a transcription text if present
            if (displayData?.type === 'message_data' && displayData?.inputText) {
              return displayData.inputText;
            }
            if (outputs?.message_data?.input_text) {
              return outputs.message_data.input_text;
            }
            if (outputs?.transcription?.text) {
              return outputs.transcription.text;
            }
            if (outputs?.message_data && typeof outputs.message_data === 'object') {
              try { return JSON.stringify(outputs.message_data, null, 2); } catch { /* noop */ }
            }
            return 'Voice recorded';
          })()}
        />
      )}

      {executionData.isSuccess && (
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
    </>
  );

  return (
    <>
      <CompactNodeContainer
        {...props}
        customColorName="rose"
        onCustomExecute={handleExecute}
      />

      {/* Voice Recording Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={(e: React.MouseEvent<HTMLElement>) => {
          e.stopPropagation();
          setDialogOpen(false);
        }}
        onClick={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}
      >
        <Box sx={{ p: 3, width: 420 }} onClick={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}>
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
              <audio 
                ref={audioRef} 
                src={audioUrl || undefined} 
                controls={true}
                preload="auto"
                autoPlay={false}
                onError={(e) => console.error('Audio element error:', e.currentTarget.error)}
                style={{ width: '100%', marginTop: '8px' }} 
              >
                Your browser does not support the audio element.
              </audio>
            </Box>
          )}

          {/* Transcription Option */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={true}
                  onChange={() => { /* reserved for future toggle */ }}
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
            <Button onClick={(e) => { e.stopPropagation(); setDialogOpen(false); }}>Cancel</Button>
            <Button 
              variant="contained" 
              startIcon={<SendIcon />}
              onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
              disabled={!audioBlob || isExecuting}
            >
              {isExecuting ? 'Sending...' : 'Send'}
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Inline results under node (consistent with ChatInput) */}
      {customContent}
    </>
  );
};
