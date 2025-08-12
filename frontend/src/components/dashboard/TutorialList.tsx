import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import { TUTORIAL_DATA } from '../../utils/dashboard';

interface Tutorial {
  title: string;
  description: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
}

interface TutorialListProps {
  onStartTutorial?: (tutorial: Tutorial) => void;
}

const TutorialList: React.FC<TutorialListProps> = ({ onStartTutorial }) => {
  const theme = useTheme();

  const getLevelColor = (level: Tutorial['level']) => {
    switch (level) {
      case 'Beginner':
        return theme.palette.success.main;
      case 'Intermediate':
        return theme.palette.warning.main;
      case 'Advanced':
        return theme.palette.error.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const handleStartTutorial = (tutorial: Tutorial) => {
    if (onStartTutorial) {
      onStartTutorial(tutorial);
    } else {
      // Default behavior - could navigate to tutorial page
      console.log('Starting tutorial:', tutorial.title);
    }
  };

  return (
    <Grid container spacing={3}>
      {TUTORIAL_DATA.map((tutorial, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card
            sx={{
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha('#fff', 0.1)}`,
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 15px 30px rgba(0,0,0,0.2)',
                border: `1px solid ${alpha('#fff', 0.2)}`,
              }
            }}
          >
            <CardContent sx={{ p: 3, flex: 1 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  color: 'white',
                  mb: 1,
                }}
              >
                {tutorial.title}
              </Typography>
              
              <Typography 
                variant="body2" 
                sx={{ 
                  color: alpha('#fff', 0.8),
                  mb: 2,
                  minHeight: 40,
                  flex: 1,
                }}
              >
                {tutorial.description}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip 
                  label={tutorial.level}
                  size="small"
                  sx={{
                    background: getLevelColor(tutorial.level),
                    color: 'white',
                    fontWeight: 600,
                  }}
                />
                <Chip 
                  label={tutorial.duration}
                  size="small"
                  sx={{
                    background: alpha('#fff', 0.2),
                    color: 'white',
                  }}
                />
              </Box>
            </CardContent>
            
            <CardActions sx={{ p: 2 }}>
              <Button 
                size="small" 
                variant="contained"
                fullWidth
                onClick={() => handleStartTutorial(tutorial)}
                sx={{
                  background: theme.palette.primary.main,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': {
                    background: theme.palette.primary.dark,
                  }
                }}
              >
                Start Tutorial
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default TutorialList;
