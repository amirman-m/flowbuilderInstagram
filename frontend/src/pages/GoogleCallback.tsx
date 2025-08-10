import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Box, Typography, CircularProgress, Alert } from '@mui/material';
import { authAPI } from '../services/api';

const GoogleCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleGoogleCallback = async () => {
      try {
        // Get authorization code from URL parameters
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        
        if (error) {
          setStatus('error');
          setError(`OAuth error: ${error}`);
          return;
        }
        
        if (!code) {
          setStatus('error');
          setError('Authorization code missing from callback');
          return;
        }
        
        // Send code to backend for token exchange
        await authAPI.googleCallback({ code });
        
        setStatus('success');
        
        // Redirect to home page after successful authentication
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
        
      } catch (err: any) {
        setStatus('error');
        const errorMessage = err.response?.data?.detail || 'Google authentication failed';
        setError(errorMessage);
        
        // Redirect to login page after error
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: `Google login failed: ${errorMessage}` 
            } 
          });
        }, 3000);
      }
    };

    handleGoogleCallback();
  }, [searchParams, navigate]);

  return (
    <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor" />
            <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="currentColor" />
          </svg>
        </Box>

        {status === 'processing' && (
          <>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Completing Google Sign In...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we set up your account
            </Typography>
          </>
        )}

        {status === 'success' && (
          <>
            <Box sx={{ mb: 2, color: 'success.main' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </Box>
            <Typography variant="h6" gutterBottom color="success.main">
              Google Sign In Successful!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Redirecting to your dashboard...
            </Typography>
          </>
        )}

        {status === 'error' && (
          <>
            <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
              {error}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Redirecting to login page...
            </Typography>
          </>
        )}
      </Box>
    </Container>
  );
};

export default GoogleCallback;
