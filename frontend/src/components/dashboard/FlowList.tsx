import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Box,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { Flow } from '../../types';
import { getRelativeTime } from '../../utils/dashboard';

interface FlowListProps {
  flows: Flow[];
  loading: boolean;
  onEdit: (flowId: number) => void;
  onDelete: (flowId: number) => void;
  onToggle: (flowId: number, isActive: boolean) => void;
}

const FlowList: React.FC<FlowListProps> = ({
  flows,
  loading,
  onEdit,
  onDelete,
  onToggle,
}) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item}>
            <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Skeleton 
                variant="rectangular" 
                height={160} 
                sx={{ borderRadius: 3, bgcolor: 'rgba(255,255,255,0.05)' }} 
              />
              <CardContent>
                <Skeleton variant="text" height={26} />
                <Skeleton variant="text" height={20} />
                <Skeleton variant="text" height={20} width="60%" />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
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
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                mb: 1.5 
              }}>
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
                      onChange={(e) => onToggle(flow.id, e.target.checked)}
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
                onClick={() => onEdit(flow.id)}
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
                  onClick={() => onDelete(flow.id)}
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
  );
};

export default FlowList;
