import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Telegram as TelegramIcon
} from '@mui/icons-material';

const API_BASE_URL = (() => {
  const apiPath = '/api/v1';
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes('localhost')) {
    const base = envUrl.replace(/\/$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }
  return apiPath;
})();

interface TelegramSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  flowId: string;
  onSettingsSaved?: () => void;
}

interface TelegramConfig {
  bot_id: string;
  bot_username: string;
  webhook_url: string;
  config_name: string;
  status: string;
}

export const TelegramSettingsDialog: React.FC<TelegramSettingsDialogProps> = ({
  open,
  onClose,
  flowId,
  onSettingsSaved
}) => {
  const [accessToken, setAccessToken] = useState('');
  const [configName, setConfigName] = useState('telegram');
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'none' | 'success' | 'error'>('none');
  const [validationMessage, setValidationMessage] = useState('');
  const [existingConfig, setExistingConfig] = useState<TelegramConfig | null>(null);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  // Load existing configuration when dialog opens
  useEffect(() => {
    if (open && flowId) {
      loadExistingConfig();
    }
  }, [open, flowId]);

  const loadExistingConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/flows/${flowId}/telegram-settings`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.has_telegram_config && data.config_data) {
          setExistingConfig(data.config_data);
          setHasExistingConfig(true);
          setConfigName(data.config_data.config_name || 'telegram');
          setValidationStatus('success');
          setValidationMessage(`Bot configured: @${data.config_data.bot_username}`);
        } else {
          setHasExistingConfig(false);
          setExistingConfig(null);
        }
      }
    } catch (error) {
      console.error('Failed to load existing Telegram config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateBotToken = async (token: string): Promise<boolean> => {
    if (!token || token.trim() === '') {
      setValidationStatus('error');
      setValidationMessage('Please enter a bot token');
      return false;
    }

    setIsValidating(true);
    setValidationStatus('none');
    setValidationMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/telegram-bot/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          access_token: token
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setValidationStatus('success');
        setValidationMessage(result.message);
        return true;
      } else {
        setValidationStatus('error');
        setValidationMessage(result.message);
        return false;
      }
    } catch (error) {
      console.error('Error validating bot token:', error);
      setValidationStatus('error');
      setValidationMessage('Failed to validate bot token. Please check your connection.');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    // If we have existing config and no new token, just close
    if (hasExistingConfig && !accessToken.trim()) {
      onClose();
      return;
    }

    // Validate token if provided
    if (accessToken.trim()) {
      const isValid = await validateBotToken(accessToken);
      if (!isValid) return;
    }

    // Save configuration
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/flows/${flowId}/telegram-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          access_token: accessToken,
          config_name: configName || 'telegram'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setValidationStatus('success');
        setValidationMessage('Telegram bot configured successfully for this flow!');
        setExistingConfig(result.config_data);
        setHasExistingConfig(true);
        
        // Notify parent component
        if (onSettingsSaved) {
          onSettingsSaved();
        }

        // Close dialog after short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setValidationStatus('error');
        setValidationMessage(result.message || 'Failed to save Telegram settings');
      }
    } catch (error) {
      console.error('Error saving Telegram settings:', error);
      setValidationStatus('error');
      setValidationMessage(error instanceof Error ? error.message : 'Failed to save Telegram settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/flows/${flowId}/telegram-settings`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setHasExistingConfig(false);
        setExistingConfig(null);
        setAccessToken('');
        setValidationStatus('none');
        setValidationMessage('');
        
        if (onSettingsSaved) {
          onSettingsSaved();
        }
      }
    } catch (error) {
      console.error('Error removing Telegram config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setAccessToken('');
    setValidationStatus('none');
    setValidationMessage('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        pb: 1
      }}>
        <TelegramIcon color="primary" />
        Telegram Bot Settings
      </DialogTitle>
      
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ pt: 1 }}>
            {/* Current Configuration Status */}
            {hasExistingConfig && existingConfig && (
              <Alert 
                severity="success" 
                sx={{ mb: 2 }}
                action={
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={handleRemoveConfig}
                    disabled={isSaving}
                  >
                    Remove
                  </Button>
                }
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Telegram bot is configured for this flow
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`@${existingConfig.bot_username}`} 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                  />
                  <Chip 
                    label={existingConfig.config_name} 
                    size="small" 
                    variant="outlined" 
                  />
                </Box>
              </Alert>
            )}

            {/* Configuration Form */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {hasExistingConfig 
                ? "Update the bot configuration or leave fields empty to keep current settings."
                : "Configure a Telegram bot for this flow. Get your bot token from @BotFather on Telegram."
              }
            </Typography>

            <TextField
              fullWidth
              label="Bot Name"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="Enter a friendly name (e.g., marketing-bot)"
              sx={{ mb: 2 }}
              helperText="This name helps you identify the bot configuration"
            />

            <TextField
              fullWidth
              label="Bot Access Token"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={hasExistingConfig ? "Enter new token to update" : "Enter your Telegram bot token"}
              sx={{ mb: 2 }}
              helperText="Get your bot token from @BotFather on Telegram"
              error={validationStatus === 'error'}
            />

            {/* Validation feedback */}
            {validationMessage && (
              <Alert
                severity={validationStatus === 'success' ? 'success' : 'error'}
                icon={validationStatus === 'success' ? <CheckCircleIcon /> : <ErrorIcon />}
                sx={{ mb: 2 }}
              >
                {validationMessage}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isValidating || isSaving || isLoading}
          startIcon={isSaving ? <CircularProgress size={16} /> : null}
        >
          {isSaving ? 'Saving...' : hasExistingConfig ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
