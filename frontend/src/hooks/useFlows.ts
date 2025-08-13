import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { flowsAPI } from '../services/api';
import { Flow } from '../types';
import { useSnackbar } from '../components/SnackbarProvider';

/**
 * Return type interface for the useFlows hook.
 * 
 * @interface UseFlowsReturn
 * @property {Flow[]} flows - Array of user's automation flows
 * @property {boolean} loading - Loading state for async operations
 * @property {string} error - Error message if any operation fails
 * @property {Function} loadFlows - Function to fetch flows from the API
 * @property {Function} createFlow - Function to create a new flow
 * @property {Function} deleteFlow - Function to delete an existing flow
 * @property {Function} toggleFlow - Function to activate/deactivate a flow
 * @property {Function} clearError - Function to clear the current error state
 */
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
 * Custom React hook for managing flow state and operations in the social media automation platform.
 * 
 * This hook provides a complete interface for flow management including CRUD operations,
 * loading states, error handling, and automatic navigation. It integrates with the global
 * snackbar system for user feedback and handles all API interactions for flow management.
 * 
 * Features:
 * - Automatic flow loading on mount
 * - Create new flows with automatic navigation to flow builder
 * - Delete flows with confirmation feedback
 * - Toggle flow activation status (draft/active)
 * - Comprehensive error handling with user-friendly messages
 * - Loading states for better UX
 * 
 * @hook
 * @example
 * ```tsx
 * import { useFlows } from '../hooks/useFlows';
 * 
 * function FlowDashboard() {
 *   const {
 *     flows,
 *     loading,
 *     error,
 *     createFlow,
 *     deleteFlow,
 *     toggleFlow,
 *     clearError
 *   } = useFlows();
 * 
 *   const handleCreateFlow = async () => {
 *     try {
 *       await createFlow('My New Flow', 'Automated social media posting');
 *       // Automatically navigates to flow builder
 *     } catch (error) {
 *       console.error('Failed to create flow:', error);
 *     }
 *   };
 * 
 *   const handleDeleteFlow = async (flowId: number) => {
 *     if (confirm('Are you sure you want to delete this flow?')) {
 *       await deleteFlow(flowId);
 *     }
 *   };
 * 
 *   if (loading) return <div>Loading flows...</div>;
 *   if (error) return <div>Error: {error}</div>;
 * 
 *   return (
 *     <div>
 *       <button onClick={handleCreateFlow}>Create New Flow</button>
 *       {flows.map(flow => (
 *         <div key={flow.id}>
 *           <h3>{flow.name}</h3>
 *           <p>{flow.description}</p>
 *           <button onClick={() => toggleFlow(flow.id, flow.status !== 'active')}>
 *             {flow.status === 'active' ? 'Deactivate' : 'Activate'}
 *           </button>
 *           <button onClick={() => handleDeleteFlow(flow.id)}>Delete</button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @returns {UseFlowsReturn} Object containing flows data, loading state, and management functions
 * 
 * @since 1.0.0
 * @author Social Media Flow Builder Team
 */
export const useFlows = (): UseFlowsReturn => {
  const { showSnackbar } = useSnackbar();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  /**
   * Loads all flows for the current user from the API.
   * Sets loading state and handles errors with snackbar notifications.
   * 
   * @async
   * @function loadFlows
   * @returns {Promise<void>} Promise that resolves when flows are loaded
   * @throws {Error} When API request fails
   */
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

  /**
   * Creates a new flow and automatically navigates to the flow builder.
   * 
   * @async
   * @function createFlow
   * @param {string} name - The name of the new flow (will be trimmed and defaulted if empty)
   * @param {string} description - The description of the new flow (will be trimmed and defaulted if empty)
   * @returns {Promise<void>} Promise that resolves when flow is created and navigation occurs
   * @throws {Error} When flow creation fails - error is re-thrown for component handling
   */
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

  /**
   * Deletes an existing flow by ID.
   * 
   * @async
   * @function deleteFlow
   * @param {number} flowId - The unique identifier of the flow to delete
   * @returns {Promise<void>} Promise that resolves when flow is deleted
   * @throws {Error} When flow deletion fails - error is re-thrown for component handling
   */
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

  /**
   * Toggles the activation status of a flow between 'active' and 'draft'.
   * Currently updates local state only - backend integration pending.
   * 
   * @function toggleFlow
   * @param {number} flowId - The unique identifier of the flow to toggle
   * @param {boolean} isActive - Whether the flow should be activated (true) or deactivated (false)
   * @todo Implement backend API call for flow activation/deactivation
   */
  const toggleFlow = (flowId: number, isActive: boolean) => {
    setFlows(prev => prev.map(flow => 
      flow.id === flowId 
        ? { ...flow, status: isActive ? 'active' : 'draft' }
        : flow
    ));
    // TODO: Implement backend API call for flow activation/deactivation
    console.log(`Flow ${flowId} ${isActive ? 'activated' : 'deactivated'}`);
  };

  /**
   * Clears the current error state.
   * 
   * @function clearError
   */
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
