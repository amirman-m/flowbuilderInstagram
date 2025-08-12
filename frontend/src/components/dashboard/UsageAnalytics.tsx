import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  useTheme,
  alpha,
} from '@mui/material';
import { Analytics as AnalyticsIcon } from '@mui/icons-material';

interface UsageAnalyticsProps {
  flowCount: number;
}

const UsageAnalytics: React.FC<UsageAnalyticsProps> = ({ flowCount }) => {
  const theme = useTheme();

  const usageData = [
    {
      label: 'Flows Created',
      current: flowCount,
      max: 50,
      color: theme.palette.primary.main,
      gradient: 'linear-gradient(45deg, #667eea, #764ba2)',
    },
    {
      label: 'API Calls',
      current: 2400,
      max: 10000,
      color: theme.palette.success.main,
      gradient: theme.palette.success.main,
    },
    {
      label: 'Storage',
      current: 1.2,
      max: 5,
      color: theme.palette.warning.main,
      gradient: theme.palette.warning.main,
      unit: 'GB',
    },
  ];

  const formatValue = (current: number, max: number, unit?: string) => {
    if (unit) {
      return `${current}${unit}/${max}${unit}`;
    }
    if (current >= 1000) {
      return `${(current / 1000).toFixed(1)}K/${(max / 1000).toFixed(0)}K`;
    }
    return `${current}/${max}`;
  };

  return (
    <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          fontWeight: 600, 
          mb: 2, 
          display: 'flex', 
          alignItems: 'center' 
        }}
      >
        <AnalyticsIcon sx={{ mr: 1, fontSize: 18 }} />
        Usage Analytics
      </Typography>
      
      {usageData.map((item, index) => (
        <Box key={item.label} sx={{ mb: index === usageData.length - 1 ? 0 : 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {formatValue(item.current, item.max, item.unit)}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={(item.current / item.max) * 100} 
            sx={{ 
              height: 6, 
              borderRadius: 3,
              bgcolor: alpha(item.color, 0.1),
              '& .MuiLinearProgress-bar': {
                background: item.gradient,
                borderRadius: 3,
              }
            }} 
          />
        </Box>
      ))}
    </Box>
  );
};

export default UsageAnalytics;
