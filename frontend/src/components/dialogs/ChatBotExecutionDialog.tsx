import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
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
import useFlowBuilderStore from '../../store/flowBuilderStore';
import { NodeExecutionStatus } from '../../types/nodes';
import nodeService from '../../services/nodeService';
import { NodeExecutorFactory } from '../nodes/executors/NodeExecutorFactory';
import { ChatInputNodeExecutor } from '../nodes/executors/ChatInputNodeExecutor';
import { DeepSeekChatNodeExecutor } from '../nodes/executors/DeepSeekChatNodeExecutor';
import { NodeExecutor } from '../nodes/core/NodeExecutor';

// Define custom node type that matches the actual structure
type CustomNode = {
  id: string;
  data?: {
    nodeType?: {
      name?: string;
    };
    instance?: {
      label?: string;
    };
    flowId?: number | string;
  };
};

interface ChatMessage {
  id: string;
  type: 'user' | 'bot' | 'system' | 'node_status';
  content: string;
  timestamp: Date;
  isProcessing?: boolean;
  nodeId?: string;
  status?: NodeExecutionStatus;
}

interface ChatBotExecutionDialogProps {
  open: boolean;
  onClose: () => void;
  flowName: string;
  triggerNodeId: string | null;
  triggerNodeType: string | null;
  onExecute: (triggerInputs: Record<string, any>) => Promise<void>;
}

const EXECUTION_TIMEOUT_MS = 60000; // 60 seconds
const NODE_EXECUTION_TIMEOUT_MS = 30000; // 30 seconds per node

export const ChatBotExecutionDialog: React.FC<ChatBotExecutionDialogProps> = ({
  open,
  onClose,
  flowName,
  triggerNodeId,
  triggerNodeType,
  onExecute
}) => {
  // Get nodes and edges from flow builder store
  const { nodes: flowNodes, edges: flowEdges } = useFlowBuilderStore();
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
  const [nodeExecutionOrder, setNodeExecutionOrder] = useState<string[]>([]);
  const [currentExecutingNodeIndex, setCurrentExecutingNodeIndex] = useState<number>(-1);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Message ID counter for ensuring unique IDs
  const messageIdCounter = useRef(0);
  
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
    // Increment counter for unique IDs
    messageIdCounter.current += 1;
    
    const newMessage: ChatMessage = {
      ...message,
      id: `${Date.now()}-${messageIdCounter.current}`,
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
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Execution timed out')), timeoutMs))
    ]);
  };


  // Initialize node execution order when dialog opens (no reset here)
  useEffect(() => {
    if (open && triggerNodeId) {
      // Get current nodes and edges from store to avoid dependency loop
      const { nodes: currentNodes, edges: currentEdges } = useFlowBuilderStore.getState();
      
      // Build execution order inline to avoid dependency issues
      if (!triggerNodeId || !currentNodes.length || !currentEdges.length) return;

      // Start with trigger node
      const executionOrder: string[] = [triggerNodeId];
      const visited = new Set<string>([triggerNodeId]);
      let nodesToProcess = [triggerNodeId];

      // Build execution graph using breadth-first traversal
      while (nodesToProcess.length > 0) {
        const nextNodes: string[] = [];
        
        for (const nodeId of nodesToProcess) {
          // Find all outgoing edges from this node
          const outgoingEdges = currentEdges.filter(edge => edge.source === nodeId);
          
          for (const edge of outgoingEdges) {
            const targetNodeId = edge.target;
            
            // Only add nodes we haven't visited yet
            if (!visited.has(targetNodeId)) {
              executionOrder.push(targetNodeId);
              nextNodes.push(targetNodeId);
              visited.add(targetNodeId);
            }
          }
        }

        nodesToProcess = nextNodes;
      }

      setNodeExecutionOrder(executionOrder);
      setCurrentExecutingNodeIndex(-1); // Reset execution index
      console.log('📋 Node execution order:', executionOrder);
    }
  }, [open, triggerNodeId]);

  // Helper: reset nodes to PENDING just-in-time when user starts execution
  const resetNodesToPending = useCallback(() => {
    if (!nodeExecutionOrder.length) return;
    const { setNodes } = useFlowBuilderStore.getState();
    setNodes((nodes) =>
      nodes.map((node) => {
        if (nodeExecutionOrder.includes(node.id)) {
          return {
            ...node,
            data: {
              ...node.data,
              instance: {
                ...((node.data as any)?.instance || {}),
                data: {
                  ...((node.data as any)?.instance?.data || {}),
                  lastExecution: {
                    status: NodeExecutionStatus.PENDING,
                    outputs: {},
                    startedAt: new Date(),
                    metadata: {}
                  }
                }
              },
              executionStatus: NodeExecutionStatus.PENDING,
              executionResult: null
            }
          };
        }
        return node;
      })
    );
    console.log('🔄 Reset nodes to PENDING status (on user execution)');
  }, [nodeExecutionOrder]);

  // Execute a single node using NodeExecutor classes for orchestrated execution
  const executeNode = async (nodeId: string, inputs: Record<string, any> = {}): Promise<any> => {
    if (!nodeId) throw new Error('No node ID provided');
    
    // Find the node in the flow with proper typing
    const node = flowNodes.find(n => n.id === nodeId) as CustomNode | undefined;
    if (!node) throw new Error(`Node ${nodeId} not found`);
    
    // Access flowId with proper typing
    const flowId = parseInt(node.data?.flowId?.toString() || '0');
    if (!flowId) throw new Error('No flow ID available');
    
    // Get node data
    const nodeData = node.data as any;
    const instance = nodeData?.instance;
    const nodeType = nodeData?.nodeType;
    const nodeLabel = instance?.label || nodeType?.name || 'Node';
    
    // Add node status message
    const statusMessageId = addMessage({
      type: 'node_status',
      content: `Executing ${nodeLabel}...`,
      nodeId: nodeId,
      status: NodeExecutionStatus.RUNNING
    });
    
    try {
      console.log(`🔄 Executing node ${nodeId} with inputs:`, inputs);
      
      // Create executor for this node type
      const executor = NodeExecutorFactory.createExecutor(
        nodeId,
        instance,
        nodeType,
        nodeData?.onNodeUpdate
      );
      
      let result;
      
      if (executor) {
        // Use NodeExecutor for orchestrated execution (preserves all rendering/status)
        console.log(`📋 Using NodeExecutor for ${nodeType?.id} node`);
        
        if (executor instanceof ChatInputNodeExecutor) {
          // Handle ChatInput node with user input
          const userInput = inputs.user_input || inputs.message_data || '';
          result = await withTimeout(
            executor.executeWithUserInput(userInput, flowId),
            NODE_EXECUTION_TIMEOUT_MS
          );
        } else if (executor instanceof DeepSeekChatNodeExecutor) {
          // Handle DeepSeek node with message input from previous nodes
          result = await withTimeout(
            executor.executeWithMessageInput(inputs, flowId),
            NODE_EXECUTION_TIMEOUT_MS
          );
        } else {
          // Generic executor execution
          result = await withTimeout(
            executor.execute({
              nodeId,
              flowId,
              inputs
            }),
            NODE_EXECUTION_TIMEOUT_MS
          );
        }
      } else {
        // Fallback to direct API execution for unsupported node types
        console.log(`⚠️ No executor found for ${nodeType?.id}, using direct API`);
        result = await withTimeout(
          nodeService.execution.executeNode(flowId, nodeId, inputs),
          NODE_EXECUTION_TIMEOUT_MS
        );
      }
      
      // Update status message to success
      updateMessage(statusMessageId, {
        content: `${nodeLabel} executed successfully`,
        status: NodeExecutionStatus.SUCCESS
      });
      
      console.log(`✅ Node ${nodeId} execution result:`, result);
      return result;
    } catch (error: any) {
      // Update status message to error
      updateMessage(statusMessageId, {
        content: `Error executing ${nodeLabel}: ${error?.message || 'Unknown error'}`,
        status: NodeExecutionStatus.ERROR
      });
      
      console.error(`❌ Node ${nodeId} execution failed:`, error);
      throw error;
    }
  };

  // Execute nodes sequentially based on execution order
  const executeNodesSequentially = async (triggerInputs: Record<string, any>) => {
    if (!nodeExecutionOrder.length) {
      throw new Error('No nodes to execute');
    }
    
    // Initialize execution results
    const results: Record<string, any> = {};
    
    try {
      // Start with trigger node
      setCurrentExecutingNodeIndex(0);
      const triggerNodeResult = await executeNode(nodeExecutionOrder[0], triggerInputs);
      results[nodeExecutionOrder[0]] = triggerNodeResult;
      
      // Execute remaining nodes in order
      for (let i = 1; i < nodeExecutionOrder.length; i++) {
        setCurrentExecutingNodeIndex(i);
        const nodeId = nodeExecutionOrder[i];
        
        // Prepare inputs for this node from previous results
        const nodeInputs = prepareNodeInputs(nodeId, results);
        
        // Execute the node
        const nodeResult = await executeNode(nodeId, nodeInputs);
        results[nodeId] = nodeResult;
      }
      
      // All nodes executed successfully
      return results;
    } catch (error) {
      // Mark remaining nodes as skipped
      for (let i = currentExecutingNodeIndex + 1; i < nodeExecutionOrder.length; i++) {
        const nodeId = nodeExecutionOrder[i];
        const node = flowNodes.find(n => n.id === nodeId) as CustomNode | undefined;
        const nodeLabel = node?.data?.instance?.label || node?.data?.nodeType?.name || 'Node';
        
        addMessage({
          type: 'node_status',
          content: `${nodeLabel} skipped due to previous error`,
          nodeId: nodeId,
          status: NodeExecutionStatus.SKIPPED
        });
      }
      
      throw error as Error;
    } finally {
      setCurrentExecutingNodeIndex(-1);
    }
  };

  // Prepare inputs for a node based on previous execution results
  const prepareNodeInputs = (nodeId: string, results: Record<string, any>): Record<string, any> => {
    const inputs: Record<string, any> = {};
    
    // Find all edges where this node is the target
    const incomingEdges = flowEdges.filter(edge => edge.target === nodeId);
    
    console.log(`🔗 Preparing inputs for node ${nodeId}, found ${incomingEdges.length} incoming edges`);
    
    for (const edge of incomingEdges) {
      const sourceNodeId = edge.source;
      const sourcePortId = edge.sourceHandle || '';
      const targetPortId = edge.targetHandle || '';
      
      console.log(`🔗 Processing edge: ${sourceNodeId}[${sourcePortId}] -> ${nodeId}[${targetPortId}]`);
      
      // If we have results for the source node
      if (results[sourceNodeId] && results[sourceNodeId].outputs) {
        const sourceOutputs = results[sourceNodeId].outputs;
        console.log(`📤 Source node ${sourceNodeId} outputs:`, sourceOutputs);
        
        // Extract the specific output port or use common output names
        let sourceOutput;
        
        // Try to get specific port output first
        if (sourcePortId && sourcePortId.includes('__')) {
          const portName = sourcePortId.split('__')[1];
          sourceOutput = sourceOutputs[portName];
        }
        
        // Fallback to common output names for ChatInput -> DeepSeek flow
        if (!sourceOutput) {
          sourceOutput = sourceOutputs.message_data || 
                        sourceOutputs.user_input || 
                        sourceOutputs.default ||
                        sourceOutputs;
        }
        
        if (sourceOutput !== undefined) {
          // Map to the target node's input
          let inputKey = 'message_data'; // Default for DeepSeek nodes
          
          if (targetPortId && targetPortId.includes('__')) {
            inputKey = targetPortId.split('__')[1];
          }
          
          inputs[inputKey] = sourceOutput;
          console.log(`📥 Mapped to input[${inputKey}]:`, sourceOutput);
        } else {
          console.warn(`⚠️ No output found for port ${sourcePortId} from node ${sourceNodeId}`);
        }
      } else {
        console.warn(`⚠️ No results found for source node ${sourceNodeId}`);
      }
    }
    
    console.log(`📋 Final inputs for node ${nodeId}:`, inputs);
    return inputs;
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
      // Reset nodes to PENDING only when user explicitly starts execution
      resetNodesToPending();
      setIsProcessing(true);

      // Execute nodes sequentially
      const results = await withTimeout(
        executeNodesSequentially({ user_input: userMessage }),
        EXECUTION_TIMEOUT_MS
      );
      
      // Call the original onExecute to sync results with store
      await onExecute({ user_input: userMessage });

      // Update processing message to success
      updateMessage(processingId, {
        type: 'system',
        content: 'Flow execution complete',
        isProcessing: false
      });
      
      // Add final bot response if available
      const lastNodeId = nodeExecutionOrder[nodeExecutionOrder.length - 1];
      const lastNodeResult = results[lastNodeId];
      
      if (lastNodeResult && lastNodeResult.outputs) {
        const botResponse = lastNodeResult.outputs.message || 
                           lastNodeResult.outputs.response || 
                           lastNodeResult.outputs.text || 
                           lastNodeResult.outputs.default || 
                           'Flow execution completed successfully.';
        
        addMessage({
          type: 'bot',
          content: typeof botResponse === 'string' ? botResponse : JSON.stringify(botResponse)
        });
      }

      showSnackbar({
        message: 'Flow executed successfully!',
        severity: 'success',
      });

    } catch (error: any) {
      console.error('Flow execution failed:', error);
      
      // Update processing message to error
      updateMessage(processingId, {
        type: 'system',
        content: 'Flow execution failed',
        isProcessing: false
      });
      
      // Add error message
      addMessage({
        type: 'bot',
        content: error?.message === 'Execution timed out' 
          ? 'Processing is taking longer than expected. Please try again later.'
          : 'Sorry, there was an error processing your request. Please try again.'
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
          // Reset nodes to PENDING only when user explicitly starts execution (voice)
          resetNodesToPending();
          setIsProcessing(true);
          
          // Convert to base64
          const reader = new FileReader();
          const audioData = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });

          // Execute nodes sequentially
          const results = await withTimeout(
            executeNodesSequentially({ voice_data: audioData }),
            EXECUTION_TIMEOUT_MS
          );
          
          // Call the original onExecute to sync results with store
          await onExecute({ voice_data: audioData });

          // Update processing message
          updateMessage(processingId, {
            type: 'system',
            content: 'Flow execution complete',
            isProcessing: false
          });
          
          // Add final bot response if available
          const lastNodeId = nodeExecutionOrder[nodeExecutionOrder.length - 1];
          const lastNodeResult = results[lastNodeId];
          
          if (lastNodeResult && lastNodeResult.outputs) {
            const botResponse = lastNodeResult.outputs.message || 
                               lastNodeResult.outputs.response || 
                               lastNodeResult.outputs.text || 
                               lastNodeResult.outputs.default || 
                               'Voice processed successfully.';
            
            addMessage({
              type: 'bot',
              content: typeof botResponse === 'string' ? botResponse : JSON.stringify(botResponse)
            });
          }

        } catch (error: any) {
          // Update processing message to error
          updateMessage(processingId, {
            type: 'system',
            content: 'Flow execution failed',
            isProcessing: false
          });
          
          // Add error message
          addMessage({
            type: 'bot',
            content: error?.message === 'Execution timed out'
              ? 'Voice processing timed out. Please try again.'
              : 'Sorry, I couldn\'t process your voice message. Please try again.'
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
    const isNodeStatus = message.type === 'node_status';

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
    
    if (isNodeStatus) {
      // Define colors based on status
      let statusColor = '#4CAF50'; // Default green
      let statusBgColor = 'rgba(76, 175, 80, 0.1)';
      let statusIcon = <PlayIcon sx={{ fontSize: 14 }} />;
      
      if (message.status === NodeExecutionStatus.RUNNING) {
        statusIcon = <CircularProgress size={14} sx={{ color: '#2196F3' }} />;
        statusColor = '#2196F3'; // Blue
        statusBgColor = 'rgba(33, 150, 243, 0.1)';
      } else if (message.status === NodeExecutionStatus.SUCCESS) {
        statusColor = '#4CAF50'; // Green
        statusBgColor = 'rgba(76, 175, 80, 0.1)';
      } else if (message.status === NodeExecutionStatus.ERROR) {
        statusColor = '#F44336'; // Red
        statusBgColor = 'rgba(244, 67, 54, 0.1)';
      } else if (message.status === NodeExecutionStatus.SKIPPED) {
        statusColor = '#9E9E9E'; // Gray
        statusBgColor = 'rgba(158, 158, 158, 0.1)';
      }
      
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
            icon={statusIcon}
            label={message.content}
            variant="outlined"
            sx={{
              backgroundColor: statusBgColor,
              borderColor: statusColor,
              color: statusColor,
              fontSize: '12px',
              height: '28px',
              '& .MuiChip-icon': {
                color: statusColor
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
                  <span>
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
                  </span>
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
                  <span>
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
                  </span>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>
      </Paper>
    </Slide>
  );
};
