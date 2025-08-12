import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { flowsAPI } from '../services/api';
import { Flow } from '../types';
import { useSnackbar } from '../components/SnackbarProvider';

export interface UseFlowsReturn {
  flows: Flow[];
  loading: boolean;
  error: string;
  loadFlows: () => Promise<void>;
  createFlow: (name: string, description: string) => Promise<void>;
  deleteFlow: (flowId: number) => Promise<void>;
  toggleFlow: (flowId: number, isActive: boolean) => void;
  clearError: () => void;
}

/**
 * Custom hook for managing flow state and operations
 */
export const useFlows = (): UseFlowsReturn => {
  const { showSnackbar } = useSnackbar();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  const loadFlows = async () => {
    try {
      setLoading(true);
      setError('');
      const flowsData = await flowsAPI.getFlows();
      setFlows(flowsData);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to load flows';
      setError(errorMsg);
      showSnackbar({
        message: errorMsg,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const createFlow = async (name: string, description: string) => {
    try {
      const payload = {
        name: name?.trim() || `New Flow ${flows.length + 1}`,
        description: description?.trim() || 'A new automation flow',
      };
      const newFlow = await flowsAPI.createFlow(payload);
      setFlows(prev => [...prev, newFlow]);
      // Navigate directly to FlowBuilder page
      navigate(`/flow/${newFlow.id}`);
      showSnackbar({
        message: 'Flow created successfully!',
        severity: 'success',
      });
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to create flow';
      setError(errorMsg);
      showSnackbar({
        message: errorMsg,
        severity: 'error',
      });
      throw err; // Re-throw to allow component to handle dialog state
    }
  };

  const deleteFlow = async (flowId: number) => {
    try {
      await flowsAPI.deleteFlow(flowId);
      setFlows(prev => prev.filter(flow => flow.id !== flowId));
      showSnackbar({
        message: 'Flow deleted successfully!',
        severity: 'success',
      });
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to delete flow';
      setError(errorMsg);
      showSnackbar({
        message: errorMsg,
        severity: 'error',
      });
      throw err;
    }
  };

  const toggleFlow = (flowId: number, isActive: boolean) => {
    setFlows(prev => prev.map(flow => 
      flow.id === flowId 
        ? { ...flow, status: isActive ? 'active' : 'draft' }
        : flow
    ));
    // TODO: Implement backend API call for flow activation/deactivation
    console.log(`Flow ${flowId} ${isActive ? 'activated' : 'deactivated'}`);
  };

  const clearError = () => {
    setError('');
  };

  useEffect(() => {
    loadFlows();
  }, []);

  return {
    flows,
    loading,
    error,
    loadFlows,
    createFlow,
    deleteFlow,
    toggleFlow,
    clearError,
  };
};
