// src/components/nodes/node-types/TranscriptionNode.tsx
import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import {
  Box, Paper, Typography, IconButton, Tooltip, CircularProgress, Alert
} from '@mui/material';
import { 
  Delete as DeleteIcon,
  PlayArrow as ExecuteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { baseNodeStyles, getCategoryColor } from '../styles';
import { NodeCategory } from '../../../types/nodes';
import { useExecutionData } from '../hooks/useExecutionData';

// OpenAI Logo SVG Component - Reused for Transcription Node
const OpenAILogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
  >
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142-.0852 4.783-2.7582a.7712.7712 0 0 0 .7806 0l5.8428 3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
  </svg>
);

export const TranscriptionNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Access React Flow instance to get nodes and edges
  const { getNodes, getEdges } = useReactFlow();
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;
  const categoryColor = getCategoryColor(NodeCategory.PROCESSOR);
  
  // Use execution data hook to get fresh execution results
  const executionData = useExecutionData(nodeData);
  
  // Handle node deletion
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    // Prefer onNodeDelete (standard across nodes) but fall back to onDelete for backward compatibility
    if (nodeData.onNodeDelete) {
      nodeData.onNodeDelete(id);
    } else if (nodeData.onDelete) {
      nodeData.onDelete(id);
    }
  };

  // Function to collect input data from connected nodes
  const collectInputsFromConnectedNodes = async (): Promise<Record<string, any>> => {
    const inputs: Record<string, any> = {};
    
    try {
      // Get current nodes and edges from React Flow
      const nodes = getNodes();
      const edges = getEdges();
      
      if (!nodes || !edges) {
        console.log('⚠️ No flow data available for input collection');
        return inputs;
      }
      
      // Find all edges that connect TO this node (incoming connections)
      const incomingEdges = edges.filter((edge: any) => edge.target === id);
      console.log('🔗 Found incoming edges:', incomingEdges);
      
      // For each incoming edge, get the output data from the source node
      for (const edge of incomingEdges) {
        const sourceNodeId = edge.source;
        const sourcePortId = edge.sourceHandle;
        const targetPortId = edge.targetHandle;
        
        // Find the source node
        const sourceNode = nodes.find((node: any) => node.id === sourceNodeId);
        if (!sourceNode) {
          console.log(`⚠️ Source node ${sourceNodeId} not found`);
          continue;
        }
        
        console.log(`📤 Collecting output from node ${sourceNodeId} (${(sourceNode.data as any)?.instance?.label || 'Unknown'})`);
        
        // Get the output data from the source node's last execution
        const sourceInstance = (sourceNode.data as any)?.instance;
        const lastExecution = sourceInstance?.data?.lastExecution;
        
        if (lastExecution && lastExecution.outputs) {
          // If there's a specific source port, get data from that port
          if (sourcePortId && lastExecution.outputs[sourcePortId]) {
            let portData = lastExecution.outputs[sourcePortId];
            
            // For transcription, we want to keep the full message_data structure
            // to access voice_input and other metadata
            
            inputs[targetPortId || sourcePortId] = portData;
            console.log(`✅ Collected from port ${sourcePortId}:`, portData);
          } else {
            // Otherwise, collect all outputs from the source node
            Object.keys(lastExecution.outputs).forEach(outputPort => {
              let portData = lastExecution.outputs[outputPort];
              
              const portKey = targetPortId || `${sourceNodeId}_${outputPort}`;
              inputs[portKey] = portData;
              console.log(`✅ Collected from ${outputPort}:`, portData);
            });
          }
        } else {
          // Try to get data from the node's instance data
          console.log('⚠️ No execution results found, checking instance data');
          
          if (sourceInstance?.data?.outputs) {
            const outputs = sourceInstance.data.outputs;
            if (sourcePortId && outputs[sourcePortId]) {
              inputs[targetPortId || sourcePortId] = outputs[sourcePortId];
              console.log(`✅ Collected from instance data port ${sourcePortId}:`, outputs[sourcePortId]);
            }
          } else if (sourceInstance?.outputs) {
            // Legacy format
            const outputs = sourceInstance.outputs;
            if (sourcePortId && outputs[sourcePortId]) {
              inputs[targetPortId || sourcePortId] = outputs[sourcePortId];
              console.log(`✅ Collected from legacy instance outputs ${sourcePortId}:`, outputs[sourcePortId]);
            }
          } else {
            console.log(`⚠️ No outputs found for node ${sourceNodeId}`);
          }
        }
      }
      
      console.log('🎯 Final collected inputs:', inputs);
      return inputs;
    } catch (error) {
      console.error('❌ Error collecting inputs:', error);
      return inputs;
    }
  };

  // Handle node execution
  const handleExecute = async (event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (isExecuting) return; // Prevent multiple executions
    
    setIsExecuting(true);
    
    try {
      console.log('🚀 Executing Transcription Node');
      
      // Collect input data from connected nodes
      const collectedInputs = await collectInputsFromConnectedNodes();
      console.log('🔌 Collected inputs from connected nodes:', collectedInputs);
      
      // Check if we have any voice input data
      let hasVoiceInput = false;
      for (const [portId, portData] of Object.entries(collectedInputs)) {
        if (typeof portData === 'object' && portData !== null) {
          if (
            (portData.voice_input && portData.input_type === 'voice') || 
            (portData.message_data && 
             typeof portData.message_data === 'object' && 
             portData.message_data.voice_input && 
             portData.message_data.input_type === 'voice')
          ) {
            hasVoiceInput = true;
            break;
          }
        }
      }
      
      if (!hasVoiceInput) {
        console.error('No voice input found in connected nodes');
        throw new Error('This node requires voice input from a Voice Input node');
      }
      
      // Prepare execution context
      const executionContext = {
        settings: {}, // No settings for transcription node
        inputs: collectedInputs,
        nodeId: id
      };
      
      // Call backend API directly
      const response = await fetch('http://localhost:8000/api/v1/nodes/execute/transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session authentication
        body: JSON.stringify(executionContext)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Transcription node execution successful:', result);
      
      // Persist execution result to the node instance so the inspector can display it
      if (nodeData.onNodeUpdate) {
        nodeData.onNodeUpdate(id, {
          data: {
            ...instance.data,
            inputs: collectedInputs,
            lastExecution: result as any // Store full execution result
          }
        });
      }
      
    } catch (error: any) {
      console.error('❌ Transcription node execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <>
      {/* Input Handles */}
      {nodeType.ports.inputs.map((port: any, index: number) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{
            top: `${20 + (index * 20)}px`,
            backgroundColor: categoryColor
          }}
        />
      ))}
      
      <Paper
        elevation={selected ? 8 : 3}
        sx={{
          ...baseNodeStyles,
          borderColor: categoryColor,
          borderWidth: selected ? 2 : 1,
          minWidth: 220,
          maxWidth: 280
        }}
      >
        {/* Node Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ color: categoryColor, mr: 1 }}>
            <OpenAILogo size={20} />
          </Box>
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            {instance.label || "Audio Transcription"}
          </Typography>
          {/* Execution button */}
          <Tooltip title={isExecuting ? "Transcribing..." : "Transcribe Audio"}>
            <IconButton 
              size="small" 
              onClick={handleExecute} 
              sx={{ ml: 0.5 }}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <CircularProgress size={16} />
              ) : (
                <ExecuteIcon fontSize="small" color="primary" />
              )}
            </IconButton>
          </Tooltip>
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
            display: 'inline-block',
            mr: 0.5
          }}
        >
          {NodeCategory.PROCESSOR}
        </Typography>
        
        <Typography
          variant="caption"
          sx={{
            backgroundColor: '#f0f0f0',
            color: 'text.secondary',
            fontSize: '0.7rem',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            display: 'inline-block'
          }}
        >
          Transcriptions
        </Typography>
        
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
        
        {/* Execution Results Display */}
        {executionData.hasFreshResults && executionData.displayData.type === 'ai_response' && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: categoryColor }}>
              Transcription:
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
              {executionData.displayData.aiResponse}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              {new Date(executionData.displayData.timestamp).toLocaleTimeString()}
            </Typography>
            {executionData.displayData.metadata && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Model: {executionData.displayData.metadata.model}
              </Typography>
            )}
          </Box>
        )}
        
        {/* Success/Error indicators */}
        {executionData.hasFreshResults && executionData.isSuccess && (
          <Alert 
            severity="success" 
            icon={<CheckCircleIcon />}
            sx={{ mt: 1, fontSize: '0.75rem' }}
          >
            <Typography variant="caption">
              Audio transcribed successfully
            </Typography>
          </Alert>
        )}
        
        {executionData.hasFreshResults && executionData.isError && (
          <Alert 
            severity="error" 
            icon={<ErrorIcon />}
            sx={{ mt: 1, fontSize: '0.75rem' }}
          >
            <Typography variant="caption">
              Transcription failed
            </Typography>
          </Alert>
        )}
        
        {/* No settings needed for this node */}
      </Paper>
    </>
  );
};
