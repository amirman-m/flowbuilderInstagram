import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import { flowsAPI } from '../services/api';
import { Flow } from '../types';

const Dashboard: React.FC = () => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    try {
      setLoading(true);
      const flowsData = await flowsAPI.getFlows();
      setFlows(flowsData);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load flows');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFlow = async () => {
    try {
      const newFlow = await flowsAPI.createFlow({
        name: `New Flow ${flows.length + 1}`,
        description: 'A new automation flow',
      });
      setFlows(prev => [...prev, newFlow]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create flow');
    }
  };

  const handleEditFlow = (flowId: number) => {
    navigate(`/flow/${flowId}`);
  };

  const handleDeleteFlow = async (flowId: number) => {
    try {
      await flowsAPI.deleteFlow(flowId);
      setFlows(prev => prev.filter(flow => flow.id !== flowId));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete flow');
    }
  };

  if (loading) {
    return (
      <Container>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateFlow}
        >
          Create Flow
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h6" gutterBottom>
        Welcome back, {user?.name}!
      </Typography>

      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        Your Flows ({flows.length})
      </Typography>

      {flows.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary">
              No flows created yet. Create your first automation flow to get started!
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {flows.map((flow) => (
            <Grid item xs={12} sm={6} md={4} key={flow.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="h2" gutterBottom>
                    {flow.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {flow.description || 'No description'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Status: {flow.status}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Created: {new Date(flow.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    startIcon={<EditIcon />}
                    onClick={() => handleEditFlow(flow.id)}
                  >
                    Edit Flow
                  </Button>
                  <Button size="small" color="error" onClick={() => handleDeleteFlow(flow.id)}>
                    Delete
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default Dashboard;
