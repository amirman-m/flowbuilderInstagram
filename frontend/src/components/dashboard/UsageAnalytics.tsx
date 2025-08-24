import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  useTheme,
  alpha,
} from '@mui/material';
import { Analytics as AnalyticsIcon } from '@mui/icons-material';
import { DEFAULT_FLOWS_MAX, DEFAULT_API_CALLS, DEFAULT_API_CALLS_CURRENT, DEFAULT_STORAGE, DEFAULT_STORAGE_USED_GB } from '../../constants';

interface UsageAnalyticsProps {
  flowCount?: number;
  analytics?: {
    flowsCreated?: number;
    flowsMax?: number;
    apiCalls: { current: number; max: number };
    storage: { usedGb: number; maxGb: number };
  };
}

// Strongly type items used in usageData so `current` and `max` are always numbers
type UsageItem = {
  label: string;
  current: number;
  max: number;
  color: string;
  gradient: string;
  unit?: string;
};

const UsageAnalytics: React.FC<UsageAnalyticsProps> = ({ flowCount, analytics }) => {
  const theme = useTheme();

  const usageData: UsageItem[] = [
    {
      label: 'Flows Created',
      current: flowCount ?? analytics?.flowsCreated ?? 0,
      max: analytics?.flowsMax ?? DEFAULT_FLOWS_MAX,
      color: theme.palette.primary.main,
      gradient: 'linear-gradient(45deg, #667eea, #764ba2)',
    },
    {
      label: 'API Calls',
      current: analytics?.apiCalls?.current ?? DEFAULT_API_CALLS_CURRENT,
      max: analytics?.apiCalls?.max ?? DEFAULT_API_CALLS.max,
      color: theme.palette.success.main,
      gradient: theme.palette.success.main,
    },
    {
      label: 'Storage',
      current: analytics?.storage?.usedGb ?? DEFAULT_STORAGE_USED_GB,
      max: analytics?.storage?.maxGb ?? DEFAULT_STORAGE.maxGb,
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
          fontWeight: 700, 
          mb: 2.5, 
          display: 'flex', 
          alignItems: 'center',
          color: 'white',
          fontSize: '1.1rem',
        }}
      >
        <AnalyticsIcon sx={{ mr: 1, fontSize: 20, color: theme.palette.primary.main }} />
        Usage Analytics
      </Typography>
      
      {usageData.map((item, index) => (
        <Box key={item.label} sx={{ mb: index === usageData.length - 1 ? 0 : 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ color: alpha('#fff', 0.8), fontWeight: 500 }}>
              {item.label}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'white' }}>
              {formatValue(item.current, item.max, item.unit)}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={item.max > 0 ? Math.min(100, (item.current / item.max) * 100) : 0} 
            sx={{ 
              height: 8, 
              borderRadius: 4,
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(4px)',
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)',
              '& .MuiLinearProgress-bar': {
                background: item.gradient,
                borderRadius: 4,
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }
            }} 
          />
        </Box>
      ))}
    </Box>
  );
};

export default UsageAnalytics;
