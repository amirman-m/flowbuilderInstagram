import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link,
  Divider,
  InputAdornment,
  IconButton,
  Grid,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import GoogleColorIcon from '../components/icons/GoogleColorIcon';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { RegisterData } from '../types';

const Register: React.FC = () => {
  const [userData, setUserData] = useState<RegisterData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // The authAPI.register function now handles the transformation
      await authAPI.register(userData);
      // Registration successful, redirect to login
      navigate('/login', { state: { message: 'Registration successful! Please login.' } });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof RegisterData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setUserData(prev => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword((show) => !show);
  };

  return (
    <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Logo */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor" />
            <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="currentColor" />
          </svg>
        </Box>
        
        <Typography component="h1" variant="h5" align="center" gutterBottom fontWeight="500">
          Create Account
        </Typography>
        
        <Paper 
          elevation={0} 
          sx={{ 
            padding: 4, 
            width: '100%', 
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            boxShadow: 'none'
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Social Login Buttons */}
          <Box sx={{ mb: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<GoogleColorIcon />}
              sx={{ 
                mb: 2, 
                py: 1.2,
                color: '#5f6368',
                borderColor: '#dadce0',
                '&:hover': {
                  borderColor: '#d2d2d2',
                  backgroundColor: 'rgba(0, 0, 0, 0.01)'
                }
              }}
            >
              Continue with Google
            </Button>
          </Box>

          {/* Divider */}
          <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
            <Divider sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
              OR
            </Typography>
            <Divider sx={{ flexGrow: 1 }} />
          </Box>

          {/* Registration Form */}
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 500 }}>
                  FIRST NAME
                </Typography>
                <TextField
                  margin="dense"
                  required
                  fullWidth
                  id="firstName"
                  placeholder="First name"
                  name="firstName"
                  autoComplete="given-name"
                  autoFocus
                  value={userData.firstName}
                  onChange={handleChange('firstName')}
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 500 }}>
                  LAST NAME
                </Typography>
                <TextField
                  margin="dense"
                  required
                  fullWidth
                  id="lastName"
                  placeholder="Last name"
                  name="lastName"
                  autoComplete="family-name"
                  value={userData.lastName}
                  onChange={handleChange('lastName')}
                  variant="outlined"
                  size="small"
                />
              </Grid>
            </Grid>
            
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 500 }}>
              EMAIL ADDRESS
            </Typography>
            <TextField
              margin="dense"
              required
              fullWidth
              id="email"
              placeholder="name@example.com"
              name="email"
              autoComplete="email"
              value={userData.email}
              onChange={handleChange('email')}
              variant="outlined"
              size="small"
              sx={{ mb: 2 }}
            />
            
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 500 }}>
              PASSWORD
            </Typography>
            <TextField
              margin="dense"
              required
              fullWidth
              name="password"
              placeholder="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="new-password"
              value={userData.password}
              onChange={handleChange('password')}
              variant="outlined"
              size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePasswordVisibility}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ 
                mt: 3, 
                mb: 2,
                py: 1.2,
                backgroundColor: '#000',
                '&:hover': {
                  backgroundColor: '#333'
                }
              }}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </Box>
        </Paper>
        
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Secure login with reCAPTCHA subject to Google
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
              <Link href="#" variant="body2" color="text.secondary">
                Terms
              </Link>
              <Typography variant="body2" color="text.secondary">&</Typography>
              <Link href="#" variant="body2" color="text.secondary">
                Privacy
              </Link>
            </Box>
          </Box>
          
          <Box sx={{ mt: 2 }}>
            <Link href="/login" variant="body2">
              Already have an account? Log in
            </Link>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default Register;
