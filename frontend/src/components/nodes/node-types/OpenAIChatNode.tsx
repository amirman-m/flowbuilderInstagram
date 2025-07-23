// src/components/nodes/node-types/OpenAIChatNode.tsx
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

// OpenAI Logo SVG Component
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

export const OpenAIChatNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
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
  
  // Get current settings from instance - FIX: Read from instance.data.settings, not instance.settings
  const currentSettings = instance?.data?.settings || {};
  
  // Debug logging to understand data flow
  console.log('🔍 OpenAI Node - Current Settings:', JSON.stringify(currentSettings, null, 2));
  console.log('🔍 OpenAI Node - Instance Data:', JSON.stringify(instance?.data, null, 2));
  console.log('🔍 OpenAI Node - Full Instance:', {
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
      
      console.log('✅ OpenAI Node - Validation Check:', {
        hasModel,
        hasSystemPrompt,
        model: currentSettings.model || 'NOT SET',
        system_prompt: currentSettings.system_prompt || 'NOT SET',
        settingsObject: currentSettings,
        validationState: !hasModel || !hasSystemPrompt ? 'ERROR' : 'SUCCESS'
      });
      
      if (!hasModel || !hasSystemPrompt) {
        console.log('❌ Setting validation state to ERROR');
        setSettingsValidationState('error');
      } else {
        console.log('✅ Setting validation state to SUCCESS');
        setSettingsValidationState('success');
      }
    };
    
    validateSettings();
  }, [currentSettings, instance]);

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    const onNodeDelete = data?.onNodeDelete;
    if (onNodeDelete && id) {
      onNodeDelete(id);
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
            
            // Special handling for Chat Input node's message_data structure
            if (typeof portData === 'object' && portData.input_text) {
              portData = portData.input_text; // Extract the actual text
              console.log(`🔄 Extracted text from message_data:`, portData);
            }
            
            inputs[targetPortId || sourcePortId] = portData;
            console.log(`✅ Collected from port ${sourcePortId}:`, portData);
          } else {
            // Otherwise, collect all outputs from the source node
            Object.keys(lastExecution.outputs).forEach(outputPort => {
              let portData = lastExecution.outputs[outputPort];
              
              // Special handling for Chat Input node's message_data structure
              if (typeof portData === 'object' && portData.input_text) {
                portData = portData.input_text; // Extract the actual text
                console.log(`🔄 Extracted text from message_data:`, portData);
              }
              
              const portKey = targetPortId || `${sourceNodeId}_${outputPort}`;
              inputs[portKey] = portData;
              console.log(`✅ Collected from ${outputPort}:`, portData);
            });
          }
        } else {
          console.log(`⚠️ No execution results found for source node ${sourceNodeId}`);
          
          // Fallback: try to get any available data from the source node
          if (sourceInstance?.data) {
            // Look for common data fields
            const fallbackData = sourceInstance.data.output || 
                                sourceInstance.data.result || 
                                sourceInstance.data.value || 
                                sourceInstance.data.text;
            
            if (fallbackData) {
              inputs[targetPortId || 'fallback'] = fallbackData;
              console.log(`🔄 Using fallback data:`, fallbackData);
            }
          }
        }
      }
      
      console.log('📋 Final collected inputs:', inputs);
      return inputs;
      
    } catch (error) {
      console.error('❌ Error collecting inputs from connected nodes:', error);
      return inputs;
    }
  };

  const handleExecute = async (event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (isExecuting) return; // Prevent multiple executions
    
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionResult(null);
    
    try {
      console.log('🚀 Executing OpenAI Chat Node with settings:', currentSettings);
      
      // Collect input data from connected nodes
      const collectedInputs = await collectInputsFromConnectedNodes();
      console.log('🔌 Collected inputs from connected nodes:', collectedInputs);
      
      // Prepare execution context
      const executionContext = {
        settings: currentSettings,
        inputs: collectedInputs,
        nodeId: id
      };
      
      // Call backend API
      const response = await fetch('http://localhost:8000/api/v1/nodes/execute/simple-openai-chat', {
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
      console.log('✅ Node execution successful:', result);
      
      // Handle successful execution - backend returns result.outputs, not result.output
      let displayResult = 'Execution completed successfully';
      if (result.outputs) {
        // Extract AI response from outputs
        if (result.outputs.ai_response) {
          // If it's an object with response text, extract it
          if (typeof result.outputs.ai_response === 'object' && result.outputs.ai_response.response) {
            displayResult = result.outputs.ai_response.response;
          } else if (typeof result.outputs.ai_response === 'string') {
            displayResult = result.outputs.ai_response;
          } else {
            displayResult = JSON.stringify(result.outputs.ai_response);
          }
        } else {
          // Fallback: show first available output
          const firstOutput = Object.values(result.outputs)[0];
          displayResult = typeof firstOutput === 'string' ? firstOutput : JSON.stringify(firstOutput);
        }
      }
      setExecutionResult(displayResult);

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
      console.error('❌ Node execution failed:', error);
      setExecutionError(error.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };



  // Get the current border color based on validation state
  const getBorderColor = () => {
    if (settingsValidationState === 'error') return '#f44336'; // Red for error
    // When settings are configured, return to original color (no special success color)
    return selected ? categoryColor : `${categoryColor}80`; // Default
  };

  const getBackgroundColor = () => {
    if (settingsValidationState === 'error') return '#ffebee'; // Light red
    // When settings are configured, return to original background (no special success color)
    return selected ? `${categoryColor}10` : 'white'; // Default
  };

  // Check if node is ready for execution (has required settings)
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
            <OpenAILogo size={20} />
          </Box>
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            {instance.label || "OpenAI Chat"}
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
              OpenAI Response:
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
              OpenAI response generated successfully
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
