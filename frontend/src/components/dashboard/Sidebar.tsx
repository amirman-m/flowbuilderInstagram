import React from 'react';
import {
  Paper,
  Box,
  Typography,
  Avatar,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { User } from '../../types';
import UsageAnalytics from './UsageAnalytics.tsx';

interface SidebarProps {
  user: User | null;
  flowCount: number;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, flowCount, onLogout }) => {
  const theme = useTheme();

  return (
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
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          p: 2, 
          borderRadius: 2, 
          bgcolor: alpha(theme.palette.primary.main, 0.1) 
        }}>
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
      <UsageAnalytics flowCount={flowCount} />

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
          onClick={onLogout}
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
  );
};

export default Sidebar;
