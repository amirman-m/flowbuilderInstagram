// src/components/nodes/node-types/InstagramTriggerNode.tsx
import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Paper, Box, Typography, IconButton, Chip, Dialog, 
  TextField, Button
} from '@mui/material';
import { Instagram as InstagramIcon, Delete as DeleteIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { baseNodeStyles, getCategoryColor } from '../styles';
import { NodeCategory } from '../../../types/nodes';

// Simple example of how to create a new node using your existing architecture
export const InstagramTriggerNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [username, setUsername] = useState('');
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeDelete } = nodeData;
  const categoryColor = getCategoryColor(NodeCategory.TRIGGER);
  
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onNodeDelete && id) {
      onNodeDelete(id);
    }
  };

  const handleSettings = () => {
    setSettingsOpen(true);
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
            <InstagramIcon />
          </Box>
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            {instance.label || "Instagram Trigger"}
          </Typography>
          <IconButton size="small" onClick={handleSettings} sx={{ ml: 0.5 }}>
            <SettingsIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={handleDelete} sx={{ ml: 0.5 }}>
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
        
        {/* Custom Content */}
        <Box sx={{ mt: 1, fontSize: '0.8rem', color: '#666' }}>
          Monitors Instagram posts
        </Box>
        
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
      
      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Box sx={{ p: 3, width: 400 }}>
          <Typography variant="h6">Instagram Settings</Typography>
          <TextField
            fullWidth
            label="Username to monitor"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{ my: 2 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={() => setSettingsOpen(false)}>
              Save
            </Button>
          </Box>
        </Box>
      </Dialog>
    </>
  );
};
