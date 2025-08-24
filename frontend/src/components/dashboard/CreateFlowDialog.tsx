import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  useTheme,
} from '@mui/material';

interface CreateFlowDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string, description: string) => Promise<void>;
  flowCount: number;
}

const CreateFlowDialog: React.FC<CreateFlowDialogProps> = ({
  open,
  onClose,
  onConfirm,
  flowCount,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm(name, description);
      handleClose();
    } catch (error) {
      // Error handling is done in the parent component
      console.error('Failed to create flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setLoading(false);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      fullWidth 
      maxWidth="sm"
      PaperProps={{
        sx: {
          backgroundColor: '#1e1e2d',
          backgroundImage: 'none',
          borderRadius: 3,
        }
      }}
    >
      <DialogTitle>Create a new flow</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Flow name (optional)"
            placeholder={`New Flow ${flowCount + 1}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            disabled={loading}
          />
          <TextField
            label="Description (optional)"
            placeholder="A new automation flow"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            disabled={loading}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={handleClose}
          disabled={loading}
          sx={{ 
            color: 'rgba(255,255,255,0.7)' 
          }}
        >
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleConfirm}
          disabled={loading}
          sx={{ 
            bgcolor: theme.palette.primary.main,
            color: '#fff',
            '&:hover': {
              bgcolor: theme.palette.primary.dark,
            }
          }}
        >
          {loading ? 'Creating...' : 'Create & Continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateFlowDialog;
