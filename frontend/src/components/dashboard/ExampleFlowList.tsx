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
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${alpha('#fff', 0.1)}`,
              backdropFilter: 'blur(10px)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                border: `1px solid ${alpha('#fff', 0.2)}`,
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
