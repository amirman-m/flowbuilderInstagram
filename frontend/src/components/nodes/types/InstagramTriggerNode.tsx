// src/components/nodes/node-types/InstagramTriggerNode.tsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box
} from '@mui/material';
import { Instagram as InstagramIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { BaseNode } from '../core/BaseNode';
import { useNodeConfiguration, useExecutionData } from '../hooks';

export const InstagramTriggerNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<any>({});
  const [validationState, setValidationState] = useState<'error' | 'success' | 'none'>('none');
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;
  
  // Use our new modular hooks
  const nodeConfig = useNodeConfiguration(nodeType?.id || 'instagram_trigger');
  const executionData = useExecutionData(nodeData);
  
  // Get current settings from instance
  const currentSettings = instance?.data?.settings || {};
  const { username = '', hashtags = '', check_interval = 300 } = currentSettings;

  // Initialize local settings when dialog opens
  useEffect(() => {
    if (settingsOpen) {
      setLocalSettings(currentSettings);
    }
  }, [settingsOpen, currentSettings]);

  // Validation effect
  useEffect(() => {
    const hasRequiredSettings = username && username.trim() !== '';
    setValidationState(hasRequiredSettings ? 'success' : 'error');
  }, [username]);

  const handleSettingsClick = () => {
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };

  const handleSettingsSave = () => {
    if (nodeData.onNodeUpdate) {
      nodeData.onNodeUpdate(id, {
        data: {
          settings: localSettings,
          inputs: instance?.data?.inputs || {}
        }
      });
    }
    setSettingsOpen(false);
  };

  const handleLocalSettingChange = (key: string, value: any) => {
    setLocalSettings((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  // Custom content for Instagram node
  const renderCustomContent = () => (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
        Username: {username || 'Not configured'}
      </Typography>
      {hashtags && (
        <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
          Hashtags: {hashtags}
        </Typography>
      )}
      <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
        Check interval: {check_interval}s
      </Typography>
      
      {/* Execution Results Display */}
      {executionData.hasFreshResults && (
        <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600 }}>
            Latest Posts:
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
              {typeof executionData.displayData === 'object' && 
               executionData.displayData && 
               'posts' in executionData.displayData && 
               Array.isArray(executionData.displayData.posts)
                ? `${executionData.displayData.posts.length} new posts found`
                : 'Monitoring active'
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
        nodeConfig={nodeConfig}
        validationState={validationState}
        onSettingsClick={handleSettingsClick}
        customContent={renderCustomContent()}
        icon={<InstagramIcon />}
      />
      
      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={handleSettingsClose} maxWidth="sm" fullWidth>
        <DialogTitle>Instagram Trigger Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="Username to Monitor"
              value={localSettings.username || ''}
              onChange={(e) => handleLocalSettingChange('username', e.target.value)}
              placeholder="Enter Instagram username (without @)"
              helperText="The Instagram account to monitor for new posts"
            />
            
            <TextField
              fullWidth
              label="Hashtags (optional)"
              value={localSettings.hashtags || ''}
              onChange={(e) => handleLocalSettingChange('hashtags', e.target.value)}
              placeholder="#hashtag1 #hashtag2"
              helperText="Filter posts by specific hashtags"
            />
            
            <TextField
              fullWidth
              label="Check Interval (seconds)"
              type="number"
              value={localSettings.check_interval || 300}
              onChange={(e) => handleLocalSettingChange('check_interval', parseInt(e.target.value))}
              inputProps={{ min: 60, max: 3600 }}
              helperText="How often to check for new posts (60-3600 seconds)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose}>Cancel</Button>
          <Button 
            onClick={handleSettingsSave} 
            variant="contained"
            disabled={!localSettings.username}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
