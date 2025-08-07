import React, { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { LogoutOutlined } from '@mui/icons-material';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface LogoutButtonProps {
  variant?: 'text' | 'outlined' | 'contained';
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ 
  variant = 'outlined', 
  size = 'medium',
  showIcon = true 
}) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const handleLogout = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Backend will clear HttpOnly cookies and revoke tokens
      await authAPI.logout();
      // Navigation to login page is handled in authAPI.logout
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, the authAPI.logout will clear local state and redirect
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null; // Don't show logout button if user is not authenticated
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      disabled={loading}
      startIcon={showIcon && !loading ? <LogoutOutlined /> : null}
      sx={{
        minWidth: loading ? 'auto' : undefined,
      }}
    >
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        'Logout'
      )}
    </Button>
  );
};

export default LogoutButton;
