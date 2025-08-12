import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Alert,
  Button,
  alpha,
  useTheme,
} from '@mui/material';

import { useAuthStore } from '../store/authStore';
import { useFlows } from '../hooks/useFlows';
import { useDashboardSummary } from '../hooks/useDashboardSummary';
import Sidebar from '../components/dashboard/Sidebar';
import FlowList from '../components/dashboard/FlowList';
import TutorialList from '../components/dashboard/TutorialList';
import ExampleFlowList from '../components/dashboard/ExampleFlowList';
import CreateFlowDialog from '../components/dashboard/CreateFlowDialog';
import TabPanel from '../components/dashboard/TabPanel';
import DashboardHeader from '../components/dashboard/DashboardHeader';

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

  // Dashboard summary from backend
  const { data: summary } = useDashboardSummary();
  const flowsMax = summary?.flowsMax ?? 50;
  const createDisabled = flows.length >= flowsMax;

  // Event handlers
  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  const handleCreateFlow = useCallback(() => {
    if (createDisabled) {
      // Could show a snackbar here to inform the user they reached the limit
      return;
    }
    setCreateDialogOpen(true);
  }, [createDisabled]);

  const handleCancelCreateFlow = useCallback(() => {
    setCreateDialogOpen(false);
  }, []);

  const handleConfirmCreateFlow = useCallback(async (name: string, description: string) => {
    try {
      await createFlow(name, description);
      setCreateDialogOpen(false);
    } catch (e) {
      console.error(e);
      // Optionally show snackbar/alert here
    }
  }, [createFlow]);

  const handleEditFlow = useCallback((flowId: number) => {
    // Route defined in App.tsx: <Route path="/flow/:flowId" element={<FlowBuilder />} />
    navigate(`/flow/${flowId}`);
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout, navigate]);

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
        planName={summary?.planName}
        analytics={{
          flowsMax,
          apiCalls: { current: summary?.apiCalls ?? 0, max: summary?.apiCallsMax ?? 10000 },
          storage: { usedGb: summary?.storageUsedGb ?? 0, maxGb: summary?.storageMaxGb ?? 5 },
        }}
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
                  sx={{ color: theme.palette.common.white }}
                >
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {/* Tabs Navigation */}
          <DashboardHeader
            activeTab={activeTab}
            onTabChange={handleTabChange}
            loading={loading}
            onRefresh={loadFlows}
            onCreateFlow={handleCreateFlow}
            createDisabled={createDisabled}
          />

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
