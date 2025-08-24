import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

interface ModelConfigWarningDialogProps {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  nodeType: string;
  message?: string;
}

/**
 * A modern warning dialog that replaces window.confirm for model configuration warnings
 * Provides "Continue Anyway" and "Cancel" options without opening settings inspector
 */
export const ModelConfigWarningDialog: React.FC<ModelConfigWarningDialogProps> = ({
  open,
  onClose,
  onContinue,
  nodeType,
  message
}) => {
  const defaultMessage = `${nodeType} requires a Model before execution. Continue anyway?`;
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { 
          borderTop: '4px solid #ff9800',
          borderRadius: '8px'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon sx={{ color: 'warning.main' }} />
        <Typography variant="h6">Configuration Warning</Typography>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body1">
            {message || defaultMessage}
          </Typography>
        </Alert>
        
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            You can not continue without a model configuration, the execution will fail or produce unexpected results.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="primary" variant="outlined">
          Cancel
        </Button>
        <Button 
          onClick={onContinue} 
          color="warning" 
          variant="contained"
          sx={{ ml: 1 }}
        >
          Continue 
        </Button>
      </DialogActions>
    </Dialog>
  );
};
