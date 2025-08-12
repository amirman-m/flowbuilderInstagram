import React from 'react';
import { Box, Paper, Tabs, Tab, IconButton, Tooltip, Button, alpha, useTheme } from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon, School as TutorialIcon, LibraryBooks as LibraryIcon } from '@mui/icons-material';

interface DashboardHeaderProps {
  activeTab: number;
  onTabChange: (_: React.SyntheticEvent, newValue: number) => void;
  loading: boolean;
  onRefresh: () => void;
  onCreateFlow: () => void;
  createDisabled?: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeTab,
  onTabChange,
  loading,
  onRefresh,
  onCreateFlow,
  createDisabled = false,
}) => {
  const theme = useTheme();
  const white = theme.palette.common.white;

  return (
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
          onChange={onTabChange}
          sx={{
            '& .MuiTab-root': {
              color: alpha(white, 0.75),
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.95rem',
              minHeight: 44,
              '&.Mui-selected': {
                color: white,
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
              onClick={onRefresh} 
              disabled={loading}
              sx={{ 
                color: white,
                bgcolor: alpha(white, 0.12),
                '&:hover': { bgcolor: alpha(white, 0.2) }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={createDisabled ? 'Flow limit reached. Upgrade your plan to create more.' : ''}>
            <span>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onCreateFlow}
                disabled={createDisabled}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 2.25,
                  py: 1,
                  backgroundColor: theme.palette.primary.main,
                  color: white,
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                    boxShadow: 'none',
                  }
                }}
              >
                Create Flow
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
};

export default DashboardHeader;
