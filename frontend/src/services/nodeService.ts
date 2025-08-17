import api from './api';
import { 
  NodeType, 
  NodeInstance, 
  NodeExecutionResult, 
  NodeExecutionStatus,
  NodeCategory 
} from '../types/nodes';

// ============================================================================
// NODE TYPES API
// ============================================================================

export const nodeTypesAPI = {
  /**
   * Get all available node types
   */
  getNodeTypes: async (): Promise<NodeType[]> => {
    const response = await api.get('/nodes/types');
    return response.data;
  },

  /**
   * Get node types filtered by category
   */
  getNodeTypesByCategory: async (category: NodeCategory): Promise<NodeType[]> => {
    const response = await api.get(`/nodes/types?category=${category}`);
    return response.data;
  },

  /**
   * Get a specific node type by ID
   */
  getNodeType: async (typeId: string): Promise<NodeType> => {
    const response = await api.get(`/nodes/types/${typeId}`);
    return response.data;
  },

  /**
   * Search node types by name or description
   */
  searchNodeTypes: async (query: string): Promise<NodeType[]> => {
    const response = await api.get(`/nodes/types/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  /**
   * Create a new custom node type (for advanced users)
   */
  createNodeType: async (nodeType: Omit<NodeType, 'id'>): Promise<NodeType> => {
    const response = await api.post('/nodes/types', nodeType);
    return response.data;
  },

  /**
   * Update an existing node type
   */
  updateNodeType: async (typeId: string, updates: Partial<NodeType>): Promise<NodeType> => {
    const response = await api.put(`/nodes/types/${typeId}`, updates);
    return response.data;
  },

  /**
   * Delete a node type
   */
  deleteNodeType: async (typeId: string): Promise<void> => {
    await api.delete(`/nodes/types/${typeId}`);
  }
};

// ============================================================================
// NODE INSTANCES API
// ============================================================================

export const nodeInstancesAPI = {
  /**
   * Get all node instances for a specific flow
   */
  getFlowNodes: async (flowId: number): Promise<NodeInstance[]> => {
    const response = await api.get(`/flows/${flowId}/nodes`);
    return response.data;
  },

  /**
   * Get a specific node instance
   */
  getNodeInstance: async (flowId: number, nodeId: string): Promise<NodeInstance> => {
    const response = await api.get(`/flows/${flowId}/nodes/${nodeId}`);
    return response.data;
  },

  /**
   * Create a new node instance in a flow
   */
  createNodeInstance: async (
    flowId: number, 
    nodeData: {
      typeId: string;
      label: string;
      position: { x: number; y: number };
      settings?: Record<string, any>;
    }
  ): Promise<NodeInstance> => {
    const response = await api.post(`/flows/${flowId}/nodes`, nodeData);
    return response.data;
  },

  /**
   * Update a node instance
   */
  updateNodeInstance: async (
    flowId: number, 
    nodeId: string, 
    updates: Partial<NodeInstance>
  ): Promise<NodeInstance> => {
    const response = await api.put(`/flows/${flowId}/nodes/${nodeId}`, updates);
    return response.data;
  },

  /**
   * Update node position (for drag & drop)
   */
  updateNodePosition: async (
    flowId: number, 
    nodeId: string, 
    position: { x: number; y: number }
  ): Promise<NodeInstance> => {
    const response = await api.patch(`/flows/${flowId}/nodes/${nodeId}/position`, { position });
    return response.data;
  },

  /**
   * Update node settings/configuration
   */
  updateNodeSettings: async (
    flowId: number, 
    nodeId: string, 
    settings: Record<string, any>
  ): Promise<NodeInstance> => {
    const response = await api.patch(`/flows/${flowId}/nodes/${nodeId}/settings`, { settings });
    return response.data;
  },

  /**
   * Delete a node instance from a flow
   */
  deleteNodeInstance: async (flowId: number, nodeId: string): Promise<void> => {
    await api.delete(`/flows/${flowId}/nodes/${nodeId}`);
  },

  /**
   * Duplicate a node instance
   */
  duplicateNodeInstance: async (
    flowId: number, 
    nodeId: string, 
    position?: { x: number; y: number }
  ): Promise<NodeInstance> => {
    const response = await api.post(`/flows/${flowId}/nodes/${nodeId}/duplicate`, { position });
    return response.data;
  }
};

// ============================================================================
// NODE EXECUTION API
// ============================================================================

export const nodeExecutionAPI = {
  /**
   * Execute a single node instance for testing
   */
  executeNode: async (
    flowId: number, 
    nodeId: string, 
    inputs?: Record<string, any>,
    settings?: Record<string, any>
  ): Promise<NodeExecutionResult> => {
    const payload: Record<string, any> = {};
    if (inputs) payload.inputs = inputs;
    if (settings) payload.settings = settings;
    const response = await api.post(`/flows/${flowId}/nodes/${nodeId}/execute`, payload);
    return response.data;
  },

  /**
   * Get execution history for a node
   */
  getNodeExecutionHistory: async (
    flowId: number, 
    nodeId: string, 
    limit: number = 10
  ): Promise<NodeExecutionResult[]> => {
    const response = await api.get(`/flows/${flowId}/nodes/${nodeId}/executions?limit=${limit}`);
    return response.data;
  },

  /**
   * Get current execution status of a node
   */
  getNodeExecutionStatus: async (
    flowId: number, 
    nodeId: string
  ): Promise<NodeExecutionStatus> => {
    const response = await api.get(`/flows/${flowId}/nodes/${nodeId}/status`);
    return response.data.status;
  },

  /**
   * Cancel a running node execution
   */
  cancelNodeExecution: async (flowId: number, nodeId: string): Promise<void> => {
    await api.post(`/flows/${flowId}/nodes/${nodeId}/cancel`);
  },

  /**
   * Clear execution history for a node
   */
  clearNodeExecutionHistory: async (flowId: number, nodeId: string): Promise<void> => {
    await api.delete(`/flows/${flowId}/nodes/${nodeId}/executions`);
  },

  /**
   * Execute an entire flow starting from the trigger node
   */
  executeFlow: async (
    flowId: number,
    triggerInputs?: Record<string, any>
  ): Promise<{
    flow_id: number;
    flow_name: string;
    trigger_node_id: string;
    execution_results: Record<string, any>;
    executed_at: string;
    total_nodes_executed: number;
  }> => {
    const response = await api.post(`/flows/${flowId}/execute`, {
      trigger_inputs: triggerInputs || {}
    });
    return response.data;
  }
};

// ============================================================================
// NODE VALIDATION API
// ============================================================================

export const nodeValidationAPI = {
  /**
   * Validate node configuration
   */
  validateNodeConfiguration: async (
    typeId: string, 
    settings: Record<string, any>
  ): Promise<{ valid: boolean; errors: string[] }> => {
    const response = await api.post(`/nodes/types/${typeId}/validate`, { settings });
    return response.data;
  },

  /**
   * Validate all nodes in a flow
   */
  validateFlowNodes: async (flowId: number): Promise<{
    valid: boolean;
    nodeErrors: Record<string, string[]>;
  }> => {
    const response = await api.post(`/flows/${flowId}/validate`);
    return response.data;
  }
};

// ============================================================================
// COMBINED NODE SERVICE
// ============================================================================

export const nodeService = {
  types: nodeTypesAPI,
  instances: nodeInstancesAPI,
  execution: nodeExecutionAPI,
  validation: nodeValidationAPI
};

export default nodeService;
