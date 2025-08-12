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
  Tab,
  Tabs,
  Switch,
  FormControlLabel,
  Avatar,
  LinearProgress,
  Card,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Dashboard as DashboardIcon,
  Refresh as RefreshIcon,
  AccessTime as TimeIcon,
  Analytics as AnalyticsIcon,
  LibraryBooks as LibraryIcon,
  School as TutorialIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { flowsAPI } from '../services/api';
import { Flow } from '../types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';

// Interface for tab panel props
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Tab panel component for content switching
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Dashboard: React.FC = () => {
  // State management for flows and UI
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Create Flow dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowDescription, setNewFlowDescription] = useState('');
  
  // Auth and navigation hooks
  const { user, logout } = useAuthStore();
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
    // Open dialog first to ask for optional name/description
    setNewFlowName('');
    setNewFlowDescription('');
    setCreateDialogOpen(true);
  };

  const handleConfirmCreateFlow = async () => {
    try {
      const payload = {
        name: newFlowName?.trim() || `New Flow ${flows.length + 1}`,
        description: newFlowDescription?.trim() || 'A new automation flow',
      };
      const newFlow = await flowsAPI.createFlow(payload);
      setCreateDialogOpen(false);
      setFlows(prev => [...prev, newFlow]);
      // Navigate directly to FlowBuilder page
      navigate(`/flow/${newFlow.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create flow');
    }
  };

  const handleCancelCreateFlow = () => {
    setCreateDialogOpen(false);
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

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle flow toggle (active/inactive)
  const handleFlowToggle = (flowId: number, isActive: boolean) => {
    setFlows(prev => prev.map(flow => 
      flow.id === flowId 
        ? { ...flow, status: isActive ? 'active' : 'draft' }
        : flow
    ));
    // TODO: Implement backend API call for flow activation/deactivation
    console.log(`Flow ${flowId} ${isActive ? 'activated' : 'deactivated'}`);
  };

  // Handle enhanced logout with confirmation
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme.palette.mode === 'light' 
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
        display: 'flex',
      }}
    >
      {/* Sidebar */}
      <Paper
        elevation={0}
        sx={{
          width: 280,
          minHeight: '100vh',
          background: theme.palette.mode === 'light' 
            ? 'rgba(255, 255, 255, 0.95)'
            : 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: 0,
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Sidebar Header */}
        <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <DashboardIcon 
              sx={{ 
                fontSize: 28, 
                mr: 2, 
                color: theme.palette.primary.main 
              }} 
            />
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 700,
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              FlowBuilder
            </Typography>
          </Box>
          
          {/* User Profile Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
            <Avatar 
              sx={{ 
                width: 40, 
                height: 40, 
                mr: 2,
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
              }}
            >
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {user?.name || 'User'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Premium Plan
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Usage Analytics */}
        <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center' }}>
            <AnalyticsIcon sx={{ mr: 1, fontSize: 18 }} />
            Usage Analytics
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary">Flows Created</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {flows.length}/50
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={(flows.length / 50) * 100} 
              sx={{ 
                height: 6, 
                borderRadius: 3,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  borderRadius: 3,
                }
              }} 
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary">API Calls</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>2.4K/10K</Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={24} 
              sx={{ 
                height: 6, 
                borderRadius: 3,
                bgcolor: alpha(theme.palette.success.main, 0.1),
                '& .MuiLinearProgress-bar': {
                  bgcolor: theme.palette.success.main,
                  borderRadius: 3,
                }
              }} 
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary">Storage</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>1.2GB/5GB</Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={24} 
              sx={{ 
                height: 6, 
                borderRadius: 3,
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                '& .MuiLinearProgress-bar': {
                  bgcolor: theme.palette.warning.main,
                  borderRadius: 3,
                }
              }} 
            />
          </Box>
        </Box>

        {/* Navigation Menu */}
        <Box sx={{ flex: 1, p: 2 }}>
          <List sx={{ p: 0 }}>
            <ListItem 
              button 
              sx={{ 
                borderRadius: 2, 
                mb: 1,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) }
              }}
            >
              <ListItemIcon>
                <DashboardIcon sx={{ color: theme.palette.primary.main }} />
              </ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItem>
            
            <ListItem 
              button 
              sx={{ 
                borderRadius: 2, 
                mb: 1,
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
              }}
            >
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="Settings" />
            </ListItem>
          </List>
        </Box>

        {/* Enhanced Logout Button */}
        <Box sx={{ p: 3, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              py: 1.5,
              borderColor: alpha(theme.palette.error.main, 0.3),
              color: theme.palette.error.main,
              '&:hover': {
                borderColor: theme.palette.error.main,
                bgcolor: alpha(theme.palette.error.main, 0.05),
              }
            }}
          >
            Logout
          </Button>
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header removed; actions moved into Tabs bar below */}

        {/* Main Content Area */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          {/* Error Alert */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3, 
                borderRadius: 2,
                bgcolor: alpha(theme.palette.error.main, 0.1),
                border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                color: 'white',
              }}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={loadFlows}
                  sx={{ color: 'white' }}
                >
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {/* Tabs Navigation */}
          <Paper
            elevation={0}
            sx={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 2,
              mb: 3,
              p: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                sx={{
                  '& .MuiTab-root': {
                    color: alpha('#fff', 0.75),
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '0.95rem',
                    minHeight: 44,
                    '&.Mui-selected': {
                      color: 'white',
                    }
                  },
                  '& .MuiTabs-indicator': {
                    background: theme.palette.primary.main,
                    height: 3,
                    borderRadius: 2,
                  }
                }}
              >
                <Tab 
                  icon={<LibraryIcon />} 
                  iconPosition="start" 
                  label="Web Flow Library" 
                />
                <Tab 
                  icon={<TutorialIcon />} 
                  iconPosition="start" 
                  label="Tutorials" 
                />
              </Tabs>
              <Box sx={{ display: 'flex', gap: 1.5, pr: 1 }}>
                <Tooltip title="Refresh flows">
                  <IconButton 
                    onClick={loadFlows} 
                    disabled={loading}
                    sx={{ 
                      color: 'white',
                      bgcolor: alpha('#fff', 0.12),
                      '&:hover': { bgcolor: alpha('#fff', 0.2) }
                    }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateFlow}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 2.25,
                    py: 1,
                    backgroundColor: theme.palette.primary.main,
                    color: '#fff',
                    boxShadow: 'none',
                    '&:hover': {
                      backgroundColor: theme.palette.primary.dark,
                      boxShadow: 'none',
                    }
                  }}
                >
                  Create Flow
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Tab Content */}
          <TabPanel value={activeTab} index={0}>
            {/* Web Flow Library Content */}
            <Box sx={{ mb: 3 }}>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 700, 
                  color: 'white', 
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <LibraryIcon sx={{ mr: 2 }} />
                Your Flow Library
              </Typography>
              <Typography variant="body2" sx={{ color: alpha('#fff', 0.8), mb: 3 }}>
                Manage and monitor your automation flows. Toggle flows on/off to control their execution.
              </Typography>
            </Box>

            {/* Flow Cards Grid */}
            {loading ? (
              <Grid container spacing={3}>
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <Grid item xs={12} sm={6} md={3} key={item}>
                    <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
                      <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 3, bgcolor: 'rgba(255,255,255,0.05)' }} />
                      <CardContent>
                        <Skeleton variant="text" height={26} />
                        <Skeleton variant="text" height={20} />
                        <Skeleton variant="text" height={20} width="60%" />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={3}>
                {flows.map((flow) => (
                  <Grid item xs={12} sm={6} md={3} key={flow.id}>
                    <Card
                      sx={{
                        height: '100%',
                        borderRadius: 3,
                        background: '#1e1e2d',
                        border: `1px solid rgba(255, 255, 255, 0.04)`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                          border: `1px solid rgba(123, 104, 238, 0.3)`,
                        }
                      }}
                    >
                      {/* Flow Status Bar */}
                      <Box 
                        sx={{ 
                          height: 4, 
                          background: flow.status === 'active'
                            ? theme.palette.success.main
                            : theme.palette.warning.main
                         }} 
                      />
                      
                      <CardContent sx={{ p: 2.25 }}>
                        {/* Header with Toggle */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Typography 
                            variant="subtitle1" 
                            sx={{ 
                              fontWeight: 700,
                              color: 'white',
                              flex: 1,
                              mr: 1.5,
                            }}
                          >
                            {flow.name}
                          </Typography>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={flow.status === 'active'}
                                onChange={(e) => handleFlowToggle(flow.id, e.target.checked)}
                                sx={{
                                  '& .MuiSwitch-switchBase.Mui-checked': {
                                    color: theme.palette.success.main,
                                  },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    backgroundColor: theme.palette.success.main,
                                  },
                                }}
                              />
                            }
                            label=""
                            sx={{ m: 0 }}
                          />
                        </Box>

                        {/* Status Chip */}
                        <Chip 
                          label={flow.status} 
                          size="small" 
                          sx={{
                            mb: 1.5,
                            background: flow.status === 'active'
                              ? alpha(theme.palette.success.main, 0.2)
                              : alpha(theme.palette.warning.main, 0.2),
                            color: 'white',
                            fontWeight: 600,
                          }}
                        />
                        
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: alpha('#fff', 0.8),
                            mb: 1.5,
                            minHeight: 36,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {flow.description || 'No description provided'}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                          <TimeIcon sx={{ fontSize: 16, mr: 1, color: alpha('#fff', 0.6) }} />
                          <Typography variant="caption" sx={{ color: alpha('#fff', 0.6) }}>
                            Created {getRelativeTime(flow.created_at)}
                          </Typography>
                        </Box>
                      </CardContent>
                      
                      <Divider sx={{ borderColor: alpha('#fff', 0.1) }} />
                      
                      <CardActions sx={{ p: 1.5, justifyContent: 'space-between' }}>
                        <Button 
                          size="small" 
                          variant="contained"
                          startIcon={<EditIcon />}
                          onClick={() => handleEditFlow(flow.id)}
                          sx={{ 
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600,
                            mr: 1,
                            bgcolor: theme.palette.primary.main,
                            '&:hover': {
                              bgcolor: theme.palette.primary.dark,
                            }
                          }}
                        >
                          Edit Flow
                        </Button>
                        <Tooltip title="Delete flow">
                          <IconButton 
                            size="small" 
                            onClick={() => handleDeleteFlow(flow.id)}
                            sx={{
                              color: alpha('#fff', 0.7),
                              '&:hover': {
                                color: theme.palette.error.main,
                                bgcolor: alpha(theme.palette.error.main, 0.1),
                              }
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
            {/* Example Flows Section */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, mb: 2 }}>
                Example Flows
              </Typography>
              <Grid container spacing={3}>
                {[
                  { name: 'Instagram Auto Reply', description: 'Auto-reply to DMs using AI and trigger workflows.' },
                  { name: 'Telegram Support Bot', description: 'Handle support inquiries via Telegram with AI.' },
                  { name: 'Twitter Post Scheduler', description: 'Schedule and post tweets automatically.' },
                  { name: 'Lead Capture to CRM', description: 'Capture web leads and sync to your CRM.' },
                ].map((ex, idx) => (
                  <Grid item xs={12} sm={6} md={3} key={idx}>
                    <Card sx={{
                      borderRadius: 3,
                      background: 'rgba(255,255,255,0.06)',
                      border: `1px solid ${alpha('#fff', 0.1)}`,
                      backdropFilter: 'blur(10px)'
                    }}>
                      <CardContent sx={{ p: 2 }}>
                        <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                          {ex.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: alpha('#fff', 0.8), mb: 2 }}>
                          {ex.description}
                        </Typography>
                        <Button 
                          size="small"
                          variant="outlined"
                          onClick={() => setActiveTab(0)}
                          sx={{
                            textTransform: 'none',
                            borderColor: alpha('#fff', 0.2),
                            color: 'white',
                            '&:hover': {
                              borderColor: alpha('#fff', 0.35),
                              bgcolor: alpha('#fff', 0.06)
                            }
                          }}
                        >
                          Use Template
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </TabPanel>

          {/* Create Flow Dialog */}
          <Dialog 
            open={createDialogOpen} 
            onClose={handleCancelCreateFlow} 
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
                  placeholder={`New Flow ${flows.length + 1}`}
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Description (optional)"
                  placeholder="A new automation flow"
                  value={newFlowDescription}
                  onChange={(e) => setNewFlowDescription(e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button 
                onClick={handleCancelCreateFlow}
                sx={{ 
                  color: 'rgba(255,255,255,0.7)' 
                }}
              >
                Cancel
              </Button>
              <Button 
                variant="contained" 
                onClick={handleConfirmCreateFlow}
                sx={{ 
                  bgcolor: theme.palette.primary.main,
                  color: '#fff',
                  '&:hover': {
                    bgcolor: theme.palette.primary.dark,
                  }
                }}
              >
                Create & Continue
              </Button>
            </DialogActions>
          </Dialog>

          <TabPanel value={activeTab} index={1}>
            {/* Tutorials Content */}
            <Box sx={{ mb: 3 }}>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 700, 
                  color: 'white', 
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <TutorialIcon sx={{ mr: 2 }} />
                Learning Center
              </Typography>
              <Typography variant="body2" sx={{ color: alpha('#fff', 0.8), mb: 3 }}>
                Learn how to build powerful automation flows with our comprehensive tutorials.
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {[
                {
                  title: 'Getting Started',
                  description: 'Learn the basics of creating your first automation flow',
                  duration: '10 min',
                  level: 'Beginner'
                },
                {
                  title: 'Advanced Workflows',
                  description: 'Build complex multi-step automation workflows',
                  duration: '25 min',
                  level: 'Advanced'
                },
                {
                  title: 'API Integration',
                  description: 'Connect external services and APIs to your flows',
                  duration: '15 min',
                  level: 'Intermediate'
                },
                {
                  title: 'Best Practices',
                  description: 'Tips and tricks for optimizing your automation flows',
                  duration: '20 min',
                  level: 'Intermediate'
                }
              ].map((tutorial, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Card
                    sx={{
                      borderRadius: 3,
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${alpha('#fff', 0.1)}`,
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 15px 30px rgba(0,0,0,0.2)',
                        border: `1px solid ${alpha('#fff', 0.2)}`,
                      }
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 700,
                          color: 'white',
                          mb: 1,
                        }}
                      >
                        {tutorial.title}
                      </Typography>
                      
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: alpha('#fff', 0.8),
                          mb: 2,
                          minHeight: 40,
                        }}
                      >
                        {tutorial.description}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Chip 
                          label={tutorial.level}
                          size="small"
                          sx={{
                            background: tutorial.level === 'Beginner' 
                              ? theme.palette.success.main
                              : tutorial.level === 'Intermediate'
                              ? theme.palette.warning.main
                              : theme.palette.error.main,
                            color: 'white',
                            fontWeight: 600,
                          }}
                        />
                        <Chip 
                          label={tutorial.duration}
                          size="small"
                          sx={{
                            background: alpha('#fff', 0.2),
                            color: 'white',
                          }}
                        />
                      </Box>
                    </CardContent>
                    
                    <CardActions sx={{ p: 2 }}>
                      <Button 
                        size="small" 
                        variant="contained"
                        fullWidth
                        sx={{
                          background: theme.palette.primary.main,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          '&:hover': {
                            background: theme.palette.primary.dark,
                          }
                        }}
                      >
                        Start Tutorial
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </TabPanel>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;