import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  useTheme,
  alpha,
} from '@mui/material';
import { EXAMPLE_FLOWS } from '../../utils/dashboard';

interface ExampleFlow {
  name: string;
  description: string;
}

interface ExampleFlowListProps {
  onUseTemplate?: (example: ExampleFlow) => void;
}

const ExampleFlowList: React.FC<ExampleFlowListProps> = ({ onUseTemplate }) => {
  const theme = useTheme();

  const handleUseTemplate = (example: ExampleFlow) => {
    if (onUseTemplate) {
      onUseTemplate(example);
    } else {
      // Default behavior - could create a flow from template
      console.log('Using template:', example.name);
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, mb: 2 }}>
        Example Flows
      </Typography>
      <Grid container spacing={3}>
        {EXAMPLE_FLOWS.map((example, idx) => (
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Card sx={{
              borderRadius: 3,
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${alpha('#fff', 0.12)}`,
              backdropFilter: 'blur(16px)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                transform: 'translateY(-6px)',
                boxShadow: '0 16px 32px rgba(0, 0, 0, 0.35)',
                border: `1px solid ${alpha('#fff', 0.25)}`,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, #7b68ee, #4cc9f0)',
                }
              }
            }}>
              <CardContent sx={{ p: 2, flex: 1 }}>
                <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                  {example.name}
                </Typography>
                <Typography variant="body2" sx={{ color: alpha('#fff', 0.8), mb: 2, flex: 1 }}>
                  {example.description}
                </Typography>
                <Button 
                  size="small"
                  variant="outlined"
                  onClick={() => handleUseTemplate(example)}
                  sx={{
                    textTransform: 'none',
                    borderColor: alpha('#fff', 0.2),
                    color: 'white',
                    '&:hover': {
                      borderColor: alpha('#fff', 0.35),
                      bgcolor: alpha('#fff', 0.06)
                    }
                  }}
                >
                  Use Template
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ExampleFlowList;
