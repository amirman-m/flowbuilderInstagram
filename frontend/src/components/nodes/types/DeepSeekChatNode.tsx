// src/components/nodes/node-types/DeepSeekChatNode.tsx
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  InfoOutlined as InfoOutlinedIcon
} from '@mui/icons-material';
import BaseNodeRefactored from '../core/BaseNodeRefactored';
import { NodeComponentProps } from '../registry';
import { NodeInstance, NodeType } from '../../../types/nodes';
import { useExecutionData } from '../hooks/useExecutionData';

// DeepSeek Logo SVG Component
const DeepSeekLogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    fillRule="evenodd"
    style={{ flexShrink: 0, lineHeight: 1 }}
  >
    <title>DeepSeek</title>
    <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" />
  </svg>
);

export const DeepSeekChatNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<any>({});
  const [expandedPrompt, setExpandedPrompt] = useState(false);
  
  // Extract data from props
  const nodeType = data.nodeType as NodeType;
  const instance = data.instance as NodeInstance;
  const onNodeUpdate = data.onNodeUpdate;
  const onExecutionComplete = data.onExecutionComplete;
  
  // Use hooks with proper data structure
  const executionData = useExecutionData({ nodeType, instance, onNodeUpdate, onExecutionComplete });
  
  // Get current settings from instance
  const currentSettings = instance?.data?.settings || {};
  const { model = '', system_prompt = '', temperature = 0.7, max_tokens = 1000 } = currentSettings;
  
  // Keep localSettings in sync with instance settings continuously
  useEffect(() => {
    setLocalSettings(currentSettings);
  }, [currentSettings]);




  const handleSettingsClick = () => {
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
    setExpandedPrompt(false);
  };

  const handleSettingsSave = () => {
    // Settings are already persisted on every field change; just close
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

  // Convert any AI response payload to plain text, removing emojis/HTML/markdown
  const toPlainText = (input: any): string => {
    let text = '';
    if (typeof input === 'string') {
      text = input;
    } else if (input && typeof input === 'object') {
      if (typeof (input as any).aiResponse === 'string') {
        text = (input as any).aiResponse;
      } else if (typeof (input as any).ai_response === 'string') {
        text = (input as any).ai_response;
      } else {
        try {
          text = JSON.stringify(input);
        } catch {
          text = String(input);
        }
      }
    } else if (input != null) {
      text = String(input);
    }
    // Strip HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    // Strip basic markdown tokens
    text = text.replace(/[*_`>#-]+/g, ' ');
    
    // Collapse whitespace
    return text.replace(/\s+/g, ' ').trim();
  };

  // Custom content for DeepSeek node
  const renderCustomContent = () => (
    <Box sx={{ mt: 0.5 }}>
      {!executionData.isExecuted && (
        <>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Model: {model || 'Not configured'}
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
              title={system_prompt}
            >
              Prompt: {system_prompt}
            </Typography>
          )}
        </>
      )}

      {/* Execution Results Display */}
      {executionData.isExecuted && executionData.displayData && (
        <Box sx={{ mt: 0.5, py: 0.75, px: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, mb: 0.25, display: 'block' }}>
            Latest Execution:
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              display: 'block',
              color: '#333',
              fontSize: '0.8rem',
              lineHeight: 1.25,
              maxHeight: '180px',
              overflowY: 'auto',
              wordBreak: 'break-word',
              whiteSpace: 'normal'
            }}
          >
            {toPlainText((executionData.displayData as any).aiResponse ?? executionData.displayData)}
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <>
      <BaseNodeRefactored
        {...props}
        instance={instance}
        nodeType={nodeType}
        customContent={renderCustomContent()}
        customHeader={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeepSeekLogo size={20} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              DeepSeek Chat
            </Typography>
          </Box>
        }
        onSettingsClick={handleSettingsClick}
      />

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={handleSettingsClose} maxWidth="md" fullWidth>
        <DialogTitle>DeepSeek Chat Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  Model
                  <Tooltip
                    title="Which DeepSeek brain to use. 'deepseek-chat' is fast and cheaper. 'deepseek-reasoner' thinks deeper but is slower and costlier."
                    placement="right"
                    arrow
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 16, color: 'action.active' }} />
                  </Tooltip>
                </Box>
              </InputLabel>
              <Select
                value={localSettings.model || ''}
                label="Model"
                onChange={(e: any) => handleLocalSettingChange('model', e.target.value)}
              >
                <MenuItem value="deepseek-chat">deepseek-chat</MenuItem>
                <MenuItem value="deepseek-reasoner">deepseek-reasoner</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label={
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  System Prompt
                  <Tooltip
                    title="Tell the AI how to act. Example: 'You are a helpful assistant. Answer briefly.'"
                    placement="right"
                    arrow
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 16, color: 'action.active' }} />
                  </Tooltip>
                </Box>
              }
              multiline
              rows={expandedPrompt ? 8 : 4}
              value={localSettings.system_prompt || ''}
              onChange={(e) => handleLocalSettingChange('system_prompt', e.target.value)}
              placeholder="Enter system prompt for the AI assistant..."
              InputProps={
                expandedPrompt ? {
                  endAdornment: (
                    <IconButton onClick={() => setExpandedPrompt(false)}>
                      <ExpandLessIcon />
                    </IconButton>
                  )
                } : {
                  endAdornment: (
                    <IconButton onClick={() => setExpandedPrompt(true)}>
                      <ExpandMoreIcon />
                    </IconButton>
                  )
                }
              }
            />

            <TextField
              label={
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  Temperature
                  <Tooltip
                    title="Creativity level. Lower = safer and more exact. Higher = more creative and random."
                    placement="right"
                    arrow
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 16, color: 'action.active' }} />
                  </Tooltip>
                </Box>
              }
              type="number"
              value={localSettings.temperature || 0.7}
              onChange={(e) => handleLocalSettingChange('temperature', parseFloat(e.target.value))}
              inputProps={{ min: 0, max: 2, step: 0.1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose}>Cancel</Button>
          <Button 
            onClick={handleSettingsSave} 
            variant="contained"
            disabled={false}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
