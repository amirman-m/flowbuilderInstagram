import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  Grid,
  CardContent,
  CardActions,
  Alert,
  Paper,
  Divider,
  Chip,
  Skeleton,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Dashboard as DashboardIcon,
  Refresh as RefreshIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { flowsAPI } from '../services/api';
import { Flow } from '../types';

const Dashboard: React.FC = () => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const theme = useTheme();

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    try {
      setLoading(true);
      setError('');
      const flowsData = await flowsAPI.getFlows();
      setFlows(flowsData);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load flows');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFlow = async () => {
    try {
      const newFlow = await flowsAPI.createFlow({
        name: `New Flow ${flows.length + 1}`,
        description: 'A new automation flow',
      });
      setFlows(prev => [...prev, newFlow]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create flow');
    }
  };

  const handleEditFlow = (flowId: number) => {
    navigate(`/flow/${flowId}`);
  };

  const handleDeleteFlow = async (flowId: number) => {
    try {
      await flowsAPI.deleteFlow(flowId);
      setFlows(prev => prev.filter(flow => flow.id !== flowId));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete flow');
    }
  };

  // Get status color based on flow status
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'draft':
        return 'info';
      case 'paused':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };
  
  // Format relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme.palette.mode === 'light' 
          ? `linear-gradient(${alpha('#e8eaf6', 0.05)}, ${alpha('#bbdefb', 0.2)})` 
          : `linear-gradient(${alpha('#263238', 0.05)}, ${alpha('#1a237e', 0.2)})`,
        pt: 2,
        pb: 6
      }}
    >
      <Container maxWidth="lg">
        {/* Header Section */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 3, 
            mb: 4, 
            borderRadius: 2,
            background: theme.palette.background.paper,
            boxShadow: theme.palette.mode === 'light' 
              ? '0 2px 15px rgba(0,0,0,0.04)' 
              : '0 2px 15px rgba(0,0,0,0.3)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <DashboardIcon 
                sx={{ 
                  fontSize: 32, 
                  mr: 2, 
                  color: theme.palette.primary.main 
                }} 
              />
              <Box>
                <Typography 
                  variant="h4" 
                  component="h1" 
                  sx={{ 
                    fontWeight: 600,
                    background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  Social Media Flow
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  Welcome back, {user?.name || 'User'}!
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Tooltip title="Refresh flows">
                <IconButton onClick={loadFlows} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateFlow}
                sx={{ 
                  borderRadius: '8px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 15px rgba(0,0,0,0.15)',
                  }
                }}
              >
                Create Flow
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 4, 
              borderRadius: 2,
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
            }}
            action={
              <Button color="inherit" size="small" onClick={loadFlows}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {/* Flows Section */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 3, 
            borderRadius: 2,
            background: theme.palette.background.paper,
            boxShadow: theme.palette.mode === 'light' 
              ? '0 2px 15px rgba(0,0,0,0.04)' 
              : '0 2px 15px rgba(0,0,0,0.3)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Your Flows
            </Typography>
            <Chip 
              label={`${flows.length} total`} 
              size="small" 
              color="primary" 
              variant="outlined" 
            />
          </Box>
          
          <Divider sx={{ mb: 3 }} />

          {loading ? (
            // Loading skeleton
            <Grid container spacing={3}>
              {[1, 2, 3].map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      borderRadius: 2,
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Skeleton variant="rectangular" height={24} width="70%" sx={{ mb: 1 }} />
                    <Skeleton variant="rectangular" height={16} width="90%" sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={16} width="40%" sx={{ mb: 1 }} />
                    <Skeleton variant="rectangular" height={16} width="30%" sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Skeleton variant="rectangular" height={30} width={80} />
                      <Skeleton variant="rectangular" height={30} width={80} />
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          ) : flows.length === 0 ? (
            // Empty state
            <Paper 
              elevation={0} 
              sx={{ 
                p: 4, 
                textAlign: 'center',
                borderRadius: 2,
                border: `1px dashed ${theme.palette.divider}`,
                bgcolor: alpha(theme.palette.background.paper, 0.5)
              }}
            >
              <Box 
                component="img" 
                src="/empty-state.svg" 
                alt="No flows" 
                sx={{ 
                  width: '120px', 
                  height: '120px', 
                  mb: 2,
                  opacity: 0.7
                }} 
                onError={(e) => {
                  // Fallback if image doesn't exist
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              <Typography variant="h6" gutterBottom>
                No flows created yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create your first automation flow to get started!
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleCreateFlow}
              >
                Create Your First Flow
              </Button>
            </Paper>
          ) : (
            // Flow cards
            <Grid container spacing={3}>
              {flows.map((flow) => (
                <Grid item xs={12} sm={6} md={4} key={flow.id}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: `1px solid ${theme.palette.divider}`,
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                        borderColor: 'transparent'
                      }
                    }}
                  >
                    <Box 
                      sx={{ 
                        height: '8px', 
                        bgcolor: theme.palette[getStatusColor(flow.status) as 'success' | 'info' | 'warning' | 'error' | 'primary'].main 
                      }} 
                    />
                    <CardContent sx={{ pt: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography 
                          variant="h6" 
                          component="h2" 
                          sx={{ 
                            fontWeight: 600,
                            mb: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {flow.name}
                        </Typography>
                        <Chip 
                          label={flow.status} 
                          size="small" 
                          color={getStatusColor(flow.status) as any}
                          sx={{ fontWeight: 500 }}
                        />
                      </Box>
                      
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          height: '40px'
                        }}
                      >
                        {flow.description || 'No description provided'}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <TimeIcon sx={{ fontSize: 16, mr: 0.5, color: theme.palette.text.secondary }} />
                        <Typography variant="caption" color="text.secondary">
                          Created {getRelativeTime(flow.created_at)}
                        </Typography>
                      </Box>
                    </CardContent>
                    
                    <Divider />
                    
                    <CardActions sx={{ justifyContent: 'space-between', px: 2 }}>
                      <Button 
                        size="small" 
                        variant="contained"
                        disableElevation
                        startIcon={<EditIcon />}
                        onClick={() => handleEditFlow(flow.id)}
                        sx={{ borderRadius: '6px' }}
                      >
                        Edit
                      </Button>
                      <Tooltip title="Delete flow">
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => handleDeleteFlow(flow.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default Dashboard;
