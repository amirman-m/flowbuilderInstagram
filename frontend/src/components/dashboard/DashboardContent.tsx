import React from 'react';
import {
  Box,
  Alert,
  Button,
  alpha,
  useTheme,
} from '@mui/material';

import FlowList from './FlowList';
import TutorialList from './TutorialList';
import ExampleFlowList from './ExampleFlowList';
import CreateFlowDialog from './CreateFlowDialog';
import TabPanel from './TabPanel';
import DashboardHeader from './DashboardHeader';

interface DashboardContentProps {
  activeTab: number;
  flows: any[];
  loading: boolean;
  error: string | null;
  loadFlows: () => void;
  handleTabChange: (event: React.SyntheticEvent, newValue: number) => void;
  handleCreateFlow: () => void;
  createDisabled: boolean;
  handleEditFlow: (flowId: number) => void;
  deleteFlow: (flowId: number) => void;
  toggleFlow: (flowId: number, isActive: boolean) => void;
  handleUseExample: (example: { name: string; description: string }) => void;
  handleStartTutorial: (tutorial: { title: string; description: string; duration: string; level: string }) => void;
  createDialogOpen: boolean;
  handleCancelCreateFlow: () => void;
  handleConfirmCreateFlow: (name: string, description: string) => Promise<void>;
}

const DashboardContent: React.FC<DashboardContentProps> = ({
  activeTab,
  flows,
  loading,
  error,
  loadFlows,
  handleTabChange,
  handleCreateFlow,
  createDisabled,
  handleEditFlow,
  deleteFlow,
  toggleFlow,
  handleUseExample,
  handleStartTutorial,
  createDialogOpen,
  handleCancelCreateFlow,
  handleConfirmCreateFlow,
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3, 
              borderRadius: 3,
              bgcolor: alpha(theme.palette.error.main, 0.15),
              border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
              color: 'white',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={loadFlows}
                sx={{ 
                  color: theme.palette.common.white,
                  borderColor: alpha(theme.palette.common.white, 0.3),
                  '&:hover': {
                    borderColor: alpha(theme.palette.common.white, 0.5),
                    bgcolor: alpha(theme.palette.error.main, 0.2),
                  }
                }}
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
          <ExampleFlowList onUseTemplate={handleUseExample} />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <TutorialList onStartTutorial={handleStartTutorial} />
        </TabPanel>
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

export default DashboardContent;
