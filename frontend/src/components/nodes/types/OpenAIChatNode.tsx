// src/components/nodes/node-types/OpenAIChatNode.tsx
import React, { useState, useEffect } from 'react';
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
import { BaseNode } from '../core/BaseNode';
import { useNodeConfiguration, useExecutionData } from '../hooks';
import { useNodeExecution } from '../hooks/useNodeExecution';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<any>({});
  const [expandedPrompt, setExpandedPrompt] = useState(false);
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeUpdate, onExecutionComplete } = nodeData;
  
  // Use hooks
  const nodeConfig = useNodeConfiguration(nodeType?.id || 'openai_chat');
  const executionData = useExecutionData(nodeData);
  
  // Get current settings from instance
  const currentSettings = instance?.data?.settings || {};
  const { model = '', system_prompt = '', temperature = 0.7 } = currentSettings;
  
  // Use centralized execution service
  const {
    executeNode,
    status: nodeStatus,
    message: statusMessage,
    isExecuting,
    isReadyForExecution
  } = useNodeExecution({
    nodeId: id,
    settings: currentSettings,
    requiredSettings: ['model', 'system_prompt'],
    onNodeUpdate,
    onExecutionComplete
  });
  


  // Keep localSettings in sync with instance settings
  useEffect(() => {
    setLocalSettings(currentSettings);
  }, [currentSettings]);

  const handleExecute = async () => {
    await executeNode();
  };


  const handleSettingsClick = () => {
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };

  const handleSettingsSave = () => {
    setSettingsOpen(false);
  };

  const handleLocalSettingChange = (key: string, value: any) => {
    const next = { ...(localSettings || {}), [key]: value };
    setLocalSettings(next);
    // Persist immediately so external editors stay in sync
    if (onNodeUpdate && id) {
      onNodeUpdate(id, {
        data: {
          ...instance?.data,
          settings: next
        },
        updatedAt: new Date()
      });
    }
  };

  // Initialize local settings when dialog opens
  useEffect(() => {
    if (settingsOpen) {
      setLocalSettings(currentSettings);
    }
  }, [settingsOpen, currentSettings]);




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
        nodeTypeId="openai-chat"
        nodeConfig={nodeConfig}
        status={nodeStatus}
        statusMessage={statusMessage || (isReadyForExecution ? 'Ready to execute' : 'Configure settings')}
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
