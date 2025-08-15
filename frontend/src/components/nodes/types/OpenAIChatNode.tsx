// src/components/nodes/node-types/OpenAIChatNode.tsx
import React, { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Box
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { NodeExecutionStatus } from '../../../types/nodes';
import { BaseNode } from '../core/BaseNode';
import { nodeService } from '../../../services/nodeService';
import { useNodeConfiguration, useExecutionData } from '../hooks';

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

export const OpenAIChatNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const [settingsValidationState, setSettingsValidationState] = useState<'error' | 'success' | 'none'>('none');
  const [isExecuting, setIsExecuting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<any>({});
  const [expandedPrompt, setExpandedPrompt] = useState(false);
  
  // Access React Flow instance to get nodes and edges
  const { getNodes, getEdges } = useReactFlow();
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;
  
  // Use our new modular hooks
  const nodeConfig = useNodeConfiguration(nodeType?.id || 'openai_chat');
  const executionData = useExecutionData(nodeData);
  
  // Get current settings from instance
  const currentSettings = instance?.data?.settings || {};
  const { model = '', system_prompt = '', temperature = 0.7, max_tokens = 1000, stop = '\n\n' } = currentSettings;
  


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

  const handleExecute = async () => {
    if (!model || !system_prompt) {
      alert('Please configure the model and system prompt first.');
      return;
    }

    setIsExecuting(true);

    try {
      // Collect inputs from connected nodes if needed
      // const inputs = await collectInputsFromConnectedNodes();
      
      // Execute the node with the correct parameter structure
      const result = await nodeService.execution.executeNode(
        parseInt(nodeData.flowId || '1'), // flowId as number
        id, // nodeId
        currentSettings // inputs
      );

      console.log('OpenAI execution result:', result);
      
      if (result && result.outputs) {
        // Handle successful execution
        const output = result.outputs.ai_response || result.outputs.output || 'Execution completed successfully';
        console.log('OpenAI output:', output);
        
        // Update the node's execution result
        if (nodeData.onExecutionComplete) {
          nodeData.onExecutionComplete(id, {
            status: NodeExecutionStatus.SUCCESS,
            outputs: output,
            success: true,
            timestamp: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          });
        }
      } else {
        const errorMsg = result?.error || 'Execution failed';
        console.error('OpenAI execution failed:', errorMsg);
        
        if (nodeData.onExecutionComplete) {
          nodeData.onExecutionComplete(id, {
            status: NodeExecutionStatus.ERROR,
            outputs: {},
            success: false,
            error: errorMsg,
            timestamp: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('OpenAI execution error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (nodeData.onExecutionComplete) {
        nodeData.onExecutionComplete(id, {
          status: NodeExecutionStatus.ERROR,
          outputs: {},
          success: false,
          error: errorMsg,
          timestamp: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        });
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSettingsClick = () => {
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };

  const handleLocalSettingChange = (key: string, value: any) => {
    setLocalSettings((prevSettings: Record<string, any>) => ({ ...prevSettings, [key]: value }));
  };

  const handleSettingsSave = () => {
    // Update node settings
    if (nodeData.onNodeUpdate && id) {
      nodeData.onNodeUpdate(id, {
        data: {
          ...instance?.data,
          settings: {
            ...currentSettings,
            ...localSettings
          }
        }
      });
    }
    setSettingsOpen(false);
  };

  // Initialize local settings when dialog opens
  useEffect(() => {
    if (settingsOpen) {
      setLocalSettings(currentSettings);
    }
  }, [settingsOpen, currentSettings]);

  // Validation effect
  useEffect(() => {
    const hasRequiredSettings = model && system_prompt;
    setSettingsValidationState(hasRequiredSettings ? 'success' : 'error');
  }, [model, system_prompt]);



  // Custom content for OpenAI node
  const renderCustomContent = () => (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
        Model: {model || 'Not configured'}
      </Typography>
      <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
        Temperature: {temperature}
      </Typography>
      {system_prompt && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#666', 
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '150px'
          }}
        >
          Prompt: {system_prompt}
        </Typography>
      )}

      {/* Execution Results Display */}
      {executionData.hasFreshResults && (
        <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600 }}>
            Latest Execution:
          </Typography>
          {executionData.displayData && (
            <Typography 
              variant="caption" 
              sx={{ 
                display: 'block',
                mt: 0.5,
                color: '#333',
                fontSize: '0.75rem',
                lineHeight: 1.3,
                maxHeight: '60px',
                overflow: 'hidden',
                wordBreak: 'break-word'
              }}
            >
              {typeof executionData.displayData === 'object' && executionData.displayData.aiResponse
                ? executionData.displayData.aiResponse.substring(0, 100) + (executionData.displayData.aiResponse.length > 100 ? '...' : '')
                : 'Execution completed'
              }
            </Typography>
          )}
          {executionData.lastExecuted && (
            <Typography variant="caption" sx={{ color: '#999', fontSize: '0.7rem' }}>
              {new Date(executionData.lastExecuted).toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );

  return (
    <>
      <BaseNode
        {...props}
        nodeTypeId="simple-openai-chat"
        nodeConfig={nodeConfig}
        validationState={settingsValidationState}
        isExecuting={isExecuting}
        onExecute={handleExecute}
        onSettingsClick={handleSettingsClick}
        customContent={renderCustomContent()}
        icon={<OpenAILogo />}
      />

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={handleSettingsClose} maxWidth="md" fullWidth>
        <DialogTitle>OpenAI Chat Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Model</InputLabel>
              <Select
                value={localSettings.model || ''}
                label="Model"
                onChange={(e) => handleLocalSettingChange('model', e.target.value)}
              >
                <MenuItem value="gpt-3.5-turbo">gpt-3.5-turbo</MenuItem>
                <MenuItem value="gpt-4">gpt-4</MenuItem>
                <MenuItem value="gpt-4-turbo">gpt-4-turbo</MenuItem>
                <MenuItem value="gpt-4o">gpt-4o</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="System Prompt"
              multiline
              rows={expandedPrompt ? 8 : 4}
              value={localSettings.system_prompt || ''}
              onChange={(e) => handleLocalSettingChange('system_prompt', e.target.value)}
              placeholder="Enter system prompt for the AI assistant..."
              InputProps={{
                endAdornment: (
                  <Button
                    size="small"
                    onClick={() => setExpandedPrompt(!expandedPrompt)}
                    sx={{ minWidth: 'auto', p: 0.5 }}
                  >
                    {expandedPrompt ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </Button>
                )
              }}
            />

            <TextField
              label="Temperature"
              type="number"
              value={localSettings.temperature || 0.7}
              onChange={(e) => handleLocalSettingChange('temperature', parseFloat(e.target.value))}
              inputProps={{ min: 0, max: 2, step: 0.1 }}
            />

            <TextField
              label="Max Tokens"
              type="number"
              value={localSettings.max_tokens || 1000}
              onChange={(e) => handleLocalSettingChange('max_tokens', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 4000 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose}>Cancel</Button>
          <Button 
            onClick={handleSettingsSave} 
            variant="contained"
            disabled={!localSettings.model || !localSettings.system_prompt}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
