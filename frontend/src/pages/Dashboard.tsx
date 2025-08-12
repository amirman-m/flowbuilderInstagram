import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Alert,
  Tabs,
  Tab,
  Paper,
  Button,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  School as TutorialIcon,
  LibraryBooks as LibraryIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { useFlows } from '../hooks/useFlows';
import Sidebar from '../components/dashboard/Sidebar';
import FlowList from '../components/dashboard/FlowList';
import TutorialList from '../components/dashboard/TutorialList';
import ExampleFlowList from '../components/dashboard/ExampleFlowList';
import CreateFlowDialog from '../components/dashboard/CreateFlowDialog';
import TabPanel from '../components/dashboard/TabPanel';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Auth and navigation hooks
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const theme = useTheme();

  // Flow management hook
  const { 
    flows, 
    loading, 
    error, 
    loadFlows, 
    createFlow, 
    deleteFlow, 
    toggleFlow, 
  } = useFlows();

  // Event handlers
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleCreateFlow = () => {
    setCreateDialogOpen(true);
  };

  const handleCancelCreateFlow = () => {
    setCreateDialogOpen(false);
  };

  const handleConfirmCreateFlow = async (name: string, description: string) => {
    await createFlow(name, description);
    setCreateDialogOpen(false);
  };

  const handleEditFlow = (flowId: number) => {
    // Route defined in App.tsx: <Route path="/flow/:flowId" element={<FlowBuilder />} />
    navigate(`/flow/${flowId}`);
  };

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
      <Sidebar 
        user={user} 
        flowCount={flows.length} 
        onLogout={handleLogout} 
      />

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
            <FlowList 
              flows={flows}
              loading={loading}
              onEdit={handleEditFlow}
              onDelete={deleteFlow}
              onToggle={toggleFlow}
            />
            <ExampleFlowList />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <TutorialList />
          </TabPanel>
        </Box>
      </Box>

      {/* Create Flow Dialog */}
      <CreateFlowDialog
        open={createDialogOpen}
        onClose={handleCancelCreateFlow}
        onConfirm={handleConfirmCreateFlow}
        flowCount={flows.length}
      />
    </Box>
  );
};

export default Dashboard;
