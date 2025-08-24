import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  useTheme,
} from '@mui/material';

import { useAuthStore } from '../store/authStore';
import { useSnackbar } from '../components/SnackbarProvider';
import { useFlows } from '../hooks/useFlows';
import { useDashboardSummary } from '../hooks/useDashboardSummary';
import { DEFAULT_FLOWS_MAX, DEFAULT_API_CALLS, DEFAULT_STORAGE } from '../constants';
import Sidebar from '../components/dashboard/Sidebar';
import DashboardContent from '../components/dashboard/DashboardContent';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Auth and navigation hooks
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const theme = useTheme();
  
  // Snackbar hook
  const { showSnackbar } = useSnackbar();

  // Flow management hook
  const { 
    flows, 
    loading, 
    error, 
    loadFlows: loadFlowsBase, 
    createFlow, 
    deleteFlow, 
    toggleFlow, 
    clearError,
  } = useFlows();

  const handleLoadFlows = useCallback(async () => {
    await loadFlowsBase();
    if (error) {
      showSnackbar({
        message: error,
        severity: 'error',
      });
      clearError();
    }
  }, [loadFlowsBase, error, showSnackbar, clearError]);

  // Dashboard summary from backend
  const { data: summary } = useDashboardSummary();
  const flowsMax = summary?.flowsMax ?? DEFAULT_FLOWS_MAX;
  const createDisabled = flows.length >= flowsMax;

  // Event handlers
  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  const handleCreateFlow = useCallback(() => {
    if (createDisabled) {
      showSnackbar({
        message: 'Flow limit reached. Upgrade your plan to create more flows.',
        severity: 'warning',
      });
      return;
    }
    setCreateDialogOpen(true);
  }, [createDisabled, showSnackbar]);

  const loadFlows = useCallback(async () => {
    await loadFlowsBase();
    if (error) {
      showSnackbar({
        message: error,
        severity: 'error',
      });
      clearError();
    }
  }, [loadFlowsBase, error, showSnackbar, clearError]);

  const handleCancelCreateFlow = useCallback(() => {
    setCreateDialogOpen(false);
  }, []);

  const handleConfirmCreateFlow = useCallback(async (name: string, description: string) => {
    try {
      await createFlow(name, description);
      setCreateDialogOpen(false);
      showSnackbar({
        message: 'Flow created successfully',
        severity: 'success',
      });
    } catch (e: any) {
      console.error(e);
      showSnackbar({
        message: `Failed to create flow: ${e?.message || 'Unknown error'}`,
        severity: 'error',
      });
    }
  }, [createFlow, showSnackbar]);

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

  const handleUseExample = useCallback((example: { name: string; description: string }) => {
    // Logic to create a flow from template
    createFlow(example.name, example.description);
  }, [createFlow]);

  const handleStartTutorial = useCallback((tutorial: { title: string; description: string; duration: string; level: string }) => {
    // For now, we'll just show a snackbar since tutorial functionality isn't implemented
    showSnackbar({
      message: `Tutorial "${tutorial.title}" would start here. Feature coming soon!`,
      severity: 'info',
    });
  }, [showSnackbar]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme.palette.mode === 'light' 
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 10% 20%, rgba(123, 104, 238, 0.1) 0%, transparent 20%), radial-gradient(circle at 90% 80%, rgba(76, 201, 240, 0.1) 0%, transparent 20%)',
          zIndex: 0,
        }
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
          apiCalls: { current: summary?.apiCalls ?? DEFAULT_API_CALLS.current, max: summary?.apiCallsMax ?? DEFAULT_API_CALLS.max },
          storage: { usedGb: summary?.storageUsedGb ?? DEFAULT_STORAGE.usedGb, maxGb: summary?.storageMaxGb ?? DEFAULT_STORAGE.maxGb },
        }}
      />

      {/* Main Content */}
      <DashboardContent
        activeTab={activeTab}
        flows={flows}
        loading={loading}
        error={error}
        loadFlows={loadFlows}
        handleTabChange={handleTabChange}
        handleCreateFlow={handleCreateFlow}
        createDisabled={createDisabled}
        handleEditFlow={handleEditFlow}
        deleteFlow={deleteFlow}
        toggleFlow={toggleFlow}
        handleUseExample={handleUseExample}
        handleStartTutorial={handleStartTutorial}
        createDialogOpen={createDialogOpen}
        handleCancelCreateFlow={handleCancelCreateFlow}
        handleConfirmCreateFlow={handleConfirmCreateFlow}
      />
    </Box>
  );
};

export default Dashboard;
