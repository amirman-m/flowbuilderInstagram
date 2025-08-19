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
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        borderRadius: 3,
        mb: 3,
        p: 1,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        border: `1px solid ${alpha('#fff', 0.08)}`,
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
              transition: 'all 0.3s ease',
              '&.Mui-selected': {
                color: white,
                fontWeight: 700,
              },
              '&:hover': {
                color: theme.palette.primary.light,
              }
            },
            '& .MuiTabs-indicator': {
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
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
            <span>
              <IconButton 
                onClick={onRefresh} 
                disabled={loading}
                sx={{ 
                  color: white,
                  bgcolor: alpha(white, 0.12),
                  backdropFilter: 'blur(6px)',
                  transition: 'all 0.3s ease',
                  '&:hover': { 
                    bgcolor: alpha(white, 0.2),
                    transform: 'scale(1.05)',
                  }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </span>
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
                  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  color: white,
                  boxShadow: '0 4px 12px rgba(123, 104, 238, 0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: `linear-gradient(45deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                    boxShadow: '0 6px 16px rgba(123, 104, 238, 0.4)',
                    transform: 'translateY(-2px)',
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
