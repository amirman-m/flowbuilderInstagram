import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import { Code as CodeIcon, Input as InputIcon, Output as OutputIcon } from '@mui/icons-material';
import { NodeType, NodeCategory } from '../../types/nodes';

export type CategoryItem = {
  id: NodeCategory;
  name: string;
  color: string;
  icon: React.ElementType;
};

interface NodeInfoDialogProps {
  open: boolean;
  onClose: () => void;
  node: NodeType | null;
  categories: CategoryItem[];
}

export const NodeInfoDialog: React.FC<NodeInfoDialogProps> = ({ open, onClose, node, categories }) => {
  const categoryColor = node ? (categories.find((c) => c.id === node.category)?.color || '#9ca3af') : '#9ca3af';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1e1e1e',
          border: '1px solid #404040',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ color: '#f1f5f9', borderBottom: '1px solid #404040' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              backgroundColor: `${categoryColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: categoryColor,
            }}
          >
            <CodeIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: '#f1f5f9' }}>
              {node?.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#9ca3af' }}>
              {node?.category}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ color: '#f1f5f9' }}>
        <Typography variant="body2" sx={{ mb: 2, color: '#d1d5db' }}>
          {node?.description}
        </Typography>

        {node?.ports.inputs && node.ports.inputs.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <InputIcon sx={{ fontSize: 16 }} /> Inputs
            </Typography>
            {node.ports.inputs.map((input, index) => (
              <Chip
                key={index}
                label={`${input.name}: ${input.dataType}`}
                size="small"
                sx={{ mr: 1, mb: 1, backgroundColor: '#404040', color: '#f1f5f9' }}
              />
            ))}
          </Box>
        )}

        {node?.ports.outputs && node.ports.outputs.length > 0 && (
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <OutputIcon sx={{ fontSize: 16 }} /> Outputs
            </Typography>
            {node.ports.outputs.map((output, index) => (
              <Chip
                key={index}
                label={`${output.name}: ${output.dataType}`}
                size="small"
                sx={{ mr: 1, mb: 1, backgroundColor: '#404040', color: '#f1f5f9' }}
              />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid #404040' }}>
        <Button onClick={onClose} sx={{ color: '#9ca3af' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
