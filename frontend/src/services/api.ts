import axios from 'axios';
import { User, Flow, UserSession, LoginCredentials, RegisterData } from '../types';
import { NodeInstance, NodeConnection } from '../types/nodes';
import { useAuthStore } from '../store/authStore';

// Use environment variable if available, otherwise use localhost
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ? 
  import.meta.env.VITE_API_BASE_URL : 
  'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request interceptor - no need to add Authorization header since we use HttpOnly cookies
api.interceptors.request.use(
  (config) => {
    // HttpOnly cookies are automatically included with withCredentials: true
    // No manual token management needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Don't retry if this is already a refresh request to prevent infinite loops
    if (originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }
    
    // Don't try to refresh on login/register failures - only for authenticated users
    if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register')) {
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh tokens using HttpOnly cookies
        const refreshResponse = await api.post('/auth/refresh');
        const authResponse = refreshResponse.data;
        
        // Update user data in store (tokens handled by cookies)
        useAuthStore.getState().setUser(authResponse.user);
        
        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<UserSession> => {
    const response = await api.post('/auth/login', credentials);
    const authResponse = response.data;
    
    // Backend now uses HttpOnly cookies for tokens, only returns user data
    // Store user in auth store (no token needed - handled by cookies)
    useAuthStore.getState().setUser(authResponse.user);
    
    return {
      user: authResponse.user,
      message: authResponse.message
    };
  },

  register: async (userData: RegisterData): Promise<User> => {
    // Transform the data to match the backend API which expects a name field
    const apiData = {
      email: userData.email,
      password: userData.password,
      name: `${userData.firstName} ${userData.lastName}`.trim()
    };
    const response = await api.post('/auth/register', apiData);
    return response.data;
  },

  refresh: async (): Promise<UserSession | null> => {
    try {
      // Backend will use refresh token from HttpOnly cookie
      const response = await api.post('/auth/refresh');
      const authResponse = response.data;
      
      // Update user data in store (tokens handled by cookies)
      useAuthStore.getState().setUser(authResponse.user);
      
      return {
        user: authResponse.user,
        message: authResponse.message
      };
    } catch (error) {
      // Refresh failed, user needs to login again
      useAuthStore.getState().logout();
      return null;
    }
  },

  logout: async (): Promise<void> => {
    try {
      // Backend will clear HttpOnly cookies and revoke tokens
      await api.post('/auth/logout');
    } catch (error) {
      // Even if logout fails on backend, clear local state
      console.warn('Backend logout failed, but clearing local state');
    } finally {
      // Clear local auth state (user data only, cookies handled by backend)
      useAuthStore.getState().logout();
      // Redirect to login page
      window.location.href = '/login';
    }
  },

  googleCallback: async (data: { code: string }): Promise<UserSession> => {
    const response = await api.post('/auth/google/callback', data);
    const authResponse = response.data;
    
    // Store user in auth store (tokens handled by HttpOnly cookies)
    useAuthStore.getState().setUser(authResponse.user);
    
    return {
      user: authResponse.user,
      message: authResponse.message
    };
  },
};

// Flows API
export const flowsAPI = {
  getFlows: async (): Promise<Flow[]> => {
    const response = await api.get('/flows/');
    return response.data;
  },

  createFlow: async (flowData: { name: string; description?: string }): Promise<Flow> => {
    const response = await api.post('/flows/', flowData);
    return response.data;
  },

  getFlow: async (flowId: number): Promise<Flow> => {
    const response = await api.get(`/flows/${flowId}`);
    return response.data;
  },

  updateFlow: async (flowId: number, flowData: Partial<Flow>): Promise<Flow> => {
    const response = await api.put(`/flows/${flowId}`, flowData);
    return response.data;
  },

  deleteFlow: async (flowId: number): Promise<void> => {
    await api.delete(`/flows/${flowId}`);
  },

  // Node-specific operations within flows
  getFlowNodes: async (flowId: number): Promise<NodeInstance[]> => {
    const response = await api.get(`/flows/${flowId}/nodes`);
    return response.data;
  },

  getFlowConnections: async (flowId: number): Promise<NodeConnection[]> => {
    const response = await api.get(`/flows/${flowId}/connections`);
    return response.data;
  },

  updateFlowNodes: async (flowId: number, nodes: NodeInstance[]): Promise<Flow> => {
    const response = await api.put(`/flows/${flowId}/nodes`, { nodes });
    return response.data;
  },

  updateFlowConnections: async (flowId: number, connections: NodeConnection[]): Promise<Flow> => {
    const response = await api.put(`/flows/${flowId}/connections`, { connections });
    return response.data;
  },

  // Save entire flow definition (nodes, ports, edges, settings) in one call
  saveFlowDefinition: async (
    flowId: number,
    payload: {
      nodes: NodeInstance[];
      connections: NodeConnection[];
    }
  ): Promise<Flow> => {
    const response = await api.post(`/flows/${flowId}/save`, payload);
    return response.data;
  },

  executeFlow: async (flowId: number, inputs?: Record<string, any>): Promise<{ executionId: string }> => {
    const response = await api.post(`/flows/${flowId}/execute`, { inputs });
    return response.data;
  },

  getFlowExecutionStatus: async (flowId: number, executionId: string): Promise<{
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    currentNode?: string;
    results?: Record<string, any>;
    error?: string;
  }> => {
    const response = await api.get(`/flows/${flowId}/executions/${executionId}`);
    return response.data;
  },

  cancelFlowExecution: async (flowId: number, executionId: string): Promise<void> => {
    await api.post(`/flows/${flowId}/executions/${executionId}/cancel`);
  },

  deployFlow: async (flowId: number): Promise<{ deploymentId: string; webhookUrl?: string }> => {
    const response = await api.post(`/flows/${flowId}/deploy`);
    return response.data;
  },

  undeployFlow: async (flowId: number): Promise<void> => {
    await api.post(`/flows/${flowId}/undeploy`);
  },

  getFlowDeploymentStatus: async (flowId: number): Promise<{
    deployed: boolean;
    deploymentId?: string;
    webhookUrl?: string;
    lastDeployed?: string;
  }> => {
    const response = await api.get(`/flows/${flowId}/deployment`);
    return response.data;
  }
};

export default api;
