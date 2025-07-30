import axios from 'axios';
import { User, Flow, UserSession, LoginCredentials, RegisterData } from '../types';
import { NodeInstance, NodeConnection } from '../types/nodes';

// Use environment variable if available, otherwise use localhost
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ? 
  import.meta.env.VITE_API_BASE_URL : 
  'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for cookie-based auth
});

// Auth API
export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<UserSession> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  register: async (userData: RegisterData): Promise<User> => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
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
