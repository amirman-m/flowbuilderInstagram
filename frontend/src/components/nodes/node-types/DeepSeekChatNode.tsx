// src/components/nodes/node-types/DeepSeekChatNode.tsx
import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import {
  Box, Paper, Typography, IconButton, Tooltip, Zoom, CircularProgress, Alert
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
import { useExecutionData } from '../hooks/useExecutionData';

// DeepSeek Logo SVG Component
const DeepSeekLogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    fill-rule="evenodd"
    style={{ flexShrink: 0, lineHeight: 1 }}
  >
    <title>DeepSeek</title>
    <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" />
  </svg>
);

export const DeepSeekChatNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
  const [settingsValidationState, setSettingsValidationState] = useState<'error' | 'success' | 'none'>('none');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  
  // Access React Flow instance to get nodes and edges
  const { getNodes, getEdges } = useReactFlow();
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;
  const categoryColor = getCategoryColor(NodeCategory.PROCESSOR);
  
  // Use execution data hook to get fresh execution results
  const executionData = useExecutionData(nodeData);
  
  // Get current settings from instance
  const currentSettings = instance?.data?.settings || {};
  
  // Type guard for instance.data
  const instanceData = instance?.data || {};
  
  // Debug logging to understand data flow
  console.log('🔍 DeepSeek Node - Current Settings:', JSON.stringify(currentSettings, null, 2));
  console.log('🔍 DeepSeek Node - Instance Data:', JSON.stringify(instance?.data, null, 2));
  console.log('🔍 DeepSeek Node - Full Instance:', {
    id: instance?.id,
    label: instance?.label,
    hasSettings: !!instance?.settings,
    settingsKeys: instance?.settings ? Object.keys(instance.settings) : []
  });

  // Validate settings on mount and when settings change
  useEffect(() => {
    const validateSettings = () => {
      const hasModel = currentSettings.model && currentSettings.model.trim() !== '';
      const hasSystemPrompt = currentSettings.system_prompt && currentSettings.system_prompt.trim() !== '';
      
      console.log('✅ DeepSeek Node - Validation Check:', {
        hasModel,
        hasSystemPrompt,
        result: hasModel && hasSystemPrompt ? 'success' : 'error'
      });
      
      if (hasModel && hasSystemPrompt) {
        setSettingsValidationState('success');
      } else {
        setSettingsValidationState('error');
      }
    };
    
    validateSettings();
  }, [currentSettings]);
  
  // Check if node is ready for execution
  const isReadyForExecution = settingsValidationState === 'success';
  
  // Handle node deletion
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (nodeData.onNodeDelete) {
      nodeData.onNodeDelete(id);
    }
  };
  
  // Function to collect input data from connected nodes
  const collectInputsFromConnectedNodes = async (): Promise<Record<string, any>> => {
    const nodes = getNodes();
    const edges = getEdges();
    const inputs: Record<string, any> = {};
    
    // Find all edges that connect to this node's input ports
    const incomingEdges = edges.filter(edge => edge.target === id);
    
    for (const edge of incomingEdges) {
      // Find the source node
      const sourceNode = nodes.find(node => node.id === edge.source);
      if (!sourceNode) continue;
      
      // Find the source node's data
      const sourceNodeData = sourceNode.data || {};
      const sourceNodeInstance = sourceNodeData?.instance as { data?: { lastExecution?: { outputs?: Record<string, any> } } } | undefined;
      
      if (!sourceNodeInstance?.data?.lastExecution?.outputs) {
        console.warn(`Source node ${sourceNode.id} has no execution outputs`);
        continue;
      }
      
      // Get the output from the source node's last execution
      const sourceOutput = sourceNodeInstance.data.lastExecution.outputs[edge.sourceHandle || ''];
      if (sourceOutput !== undefined) {
        // Map the output to this node's input port
        inputs[edge.targetHandle || ''] = sourceOutput;
      }
    }
    
    console.log('📥 DeepSeek Node - Collected Inputs:', inputs);
    return inputs;
  };
  
  // Handle node execution
  const handleExecute = async (event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Clear previous results
    setExecutionResult(null);
    setExecutionError(null);
    
    // Validate settings
    if (settingsValidationState !== 'success') {
      setExecutionError('Node is not properly configured. Please check settings.');
      return;
    }
    
    setIsExecuting(true);
    
    try {
      // Collect inputs from connected nodes
      const inputs = await collectInputsFromConnectedNodes();
      
      // Prepare execution context
      const executionContext = {
        nodeId: id,
        nodeTypeId: nodeType.id,
        inputs,
        settings: currentSettings
      };
      
      console.log('🚀 DeepSeek Node - Executing with context:', executionContext);
      
      // Call the node execution service with correct endpoint (matching OpenAI pattern)
      const response = await fetch(`http://localhost:8000/api/v1/nodes/execute/${executionContext.nodeTypeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session authentication
        body: JSON.stringify(executionContext),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to execute node');
      }
      
      const result = await response.json();
      console.log('✅ DeepSeek Node - Execution Result:', result);
      
      // Update the node instance with execution results
      if (nodeData.onNodeUpdate) {
        nodeData.onNodeUpdate(id, {
          data: {
            ...instanceData,
            inputs,
            lastExecution: {
              status: 'success',
              timestamp: new Date().toISOString(),
              inputs,
              outputs: result.outputs,
              logs: result.logs
            }
          }
        });
      }
      
      // Show success message
      setExecutionResult(result.logs?.[0] || 'Node executed successfully');
      
    } catch (error) {
      console.error('❌ DeepSeek Node - Execution Error:', error);
      
      // Update node with error status
      if (nodeData.onNodeUpdate) {
        nodeData.onNodeUpdate(id, {
          data: {
            ...instanceData,
            lastExecution: {
              status: 'error',
              timestamp: new Date().toISOString(),
              error: error instanceof Error ? error.message : String(error)
            }
          }
        });
      }
      
      // Show error message
      setExecutionError(error instanceof Error ? error.message : String(error) || 'An unknown error occurred');
      
    } finally {
      setIsExecuting(false);
    }
  };
  
  // Get the current border color based on validation state
  const getBorderColor = () => {
    if (settingsValidationState === 'error') return '#f44336';
    if (settingsValidationState === 'success') return '#4caf50';
    return categoryColor;
  };
  
  const getBackgroundColor = () => {
    if (settingsValidationState === 'error') return '#fff2f2';
    if (settingsValidationState === 'success') return '#f2fff2';
    return 'white';
  };
  
  return (
    <>
      <Paper
        sx={{
          ...baseNodeStyles,
          borderColor: selected ? getBorderColor() : `${getBorderColor()}80`,
          borderWidth: selected ? 3 : 2,
          backgroundColor: selected ? `${categoryColor}10` : getBackgroundColor(),
          animation: settingsValidationState === 'error' ? 'pulse 2s infinite' : 'none',
          '@keyframes pulse': {
            '0%': {
              boxShadow: '0 0 0 0 rgba(244, 67, 54, 0.4)'
            },
            '70%': {
              boxShadow: '0 0 0 10px rgba(244, 67, 54, 0)'
            },
            '100%': {
              boxShadow: '0 0 0 0 rgba(244, 67, 54, 0)'
            }
          }
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
        
        {/* Validation Status Indicator - Only show warning when settings missing */}
        {settingsValidationState === 'error' && (
          <Box sx={{ position: 'absolute', top: -8, right: -8, zIndex: 10 }}>
            <Zoom in={true}>
              <Tooltip title="Configure in Property Panel">
                <WarningIcon sx={{ color: '#f44336', fontSize: 20 }} />
              </Tooltip>
            </Zoom>
          </Box>
        )}

        {/* Node Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ color: categoryColor, mr: 1 }}>
            <DeepSeekLogo size={20} />
          </Box>
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            {instance.label || "DeepSeek Chat"}
          </Typography>
          {/* Execution button - only appears when settings are configured */}
          {isReadyForExecution && (
            <Tooltip title={isExecuting ? "Executing..." : "Execute Node"}>
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
          )}
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
          {NodeCategory.PROCESSOR}
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
        
        {/* Execution Results Display - Modular approach */}
        {executionData.hasFreshResults && executionData.displayData.type === 'ai_response' && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: categoryColor }}>
              AI Response:
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
              {executionData.displayData.aiResponse}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              Input: "{executionData.displayData.inputText}" • {new Date(executionData.displayData.timestamp).toLocaleTimeString()}
            </Typography>
            {executionData.displayData.metadata && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Model: {executionData.displayData.metadata.model} • Tokens: {executionData.displayData.metadata.total_tokens}
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
              DeepSeek response generated successfully
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
              Execution failed
            </Typography>
          </Alert>
        )}
      </Paper>
    </>
  );
};
