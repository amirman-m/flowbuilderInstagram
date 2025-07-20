import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  FlowDefinition, 
  FlowStatus, 
  NodeInstance, 
  NodeConnection,
  FlowValidationResult,
  NodeValidationError,
  NodeType
} from '../types/nodes';

// ============================================================================
// FLOW STORE STATE INTERFACE
// ============================================================================

interface FlowStoreState {
  // ========== CURRENT FLOW MANAGEMENT ==========
  /** Currently active flow being edited */
  currentFlow: FlowDefinition | null;
  
  /** Whether the current flow has unsaved changes */
  hasUnsavedChanges: boolean;
  
  /** Loading state for flow operations */
  flowLoading: boolean;
  
  /** Error state for flow operations */
  flowError: string | null;
  
  // ========== FLOW LIST MANAGEMENT ==========
  /** List of all user's flows */
  flows: FlowDefinition[];
  
  /** Loading state for flows list */
  flowsLoading: boolean;
  
  /** Error state for flows list */
  flowsError: string | null;
  
  // ========== VALIDATION ==========
  /** Current validation result for the active flow */
  validationResult: FlowValidationResult | null;
  
  /** Whether validation is currently running */
  validating: boolean;
  
  // ========== ACTIONS ==========
  
  // --- Flow Management ---
  /** Create a new empty flow */
  createNewFlow: (name: string, description?: string) => void;
  
  /** Load an existing flow by ID */
  loadFlow: (flowId: string) => Promise<void>;
  
  /** Save the current flow */
  saveFlow: () => Promise<void>;
  
  /** Save the current flow with a new name (Save As) */
  saveFlowAs: (name: string, description?: string) => Promise<void>;
  
  /** Load all user flows */
  loadFlows: () => Promise<void>;
  
  /** Delete a flow */
  deleteFlow: (flowId: string) => Promise<void>;
  
  /** Deploy/activate a flow */
  deployFlow: (flowId: string) => Promise<void>;
  
  /** Deactivate a flow */
  deactivateFlow: (flowId: string) => Promise<void>;
  
  // --- Node Management ---
  /** Add a new node instance to the current flow */
  addNode: (nodeType: NodeType, position: { x: number; y: number }) => NodeInstance;
  
  /** Remove a node from the current flow */
  removeNode: (nodeId: string) => void;
  
  /** Update a node instance */
  updateNode: (nodeId: string, updates: Partial<NodeInstance>) => void;
  
  /** Update node position */
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  
  /** Update node settings */
  updateNodeSettings: (nodeId: string, settings: Record<string, any>) => void;
  
  /** Get a node by ID */
  getNode: (nodeId: string) => NodeInstance | undefined;
  
  // --- Connection Management ---
  /** Add a connection between two nodes */
  addConnection: (connection: Omit<NodeConnection, 'id'>) => NodeConnection;
  
  /** Remove a connection */
  removeConnection: (connectionId: string) => void;
  
  /** Get all connections for a specific node */
  getNodeConnections: (nodeId: string) => NodeConnection[];
  
  /** Get incoming connections for a node */
  getIncomingConnections: (nodeId: string) => NodeConnection[];
  
  /** Get outgoing connections for a node */
  getOutgoingConnections: (nodeId: string) => NodeConnection[];
  
  // --- Validation ---
  /** Validate the current flow */
  validateFlow: () => Promise<FlowValidationResult>;
  
  /** Clear validation results */
  clearValidation: () => void;
  
  // --- Utility ---
  /** Mark flow as having unsaved changes */
  markAsChanged: () => void;
  
  /** Clear unsaved changes flag */
  markAsSaved: () => void;
  
  /** Reset store to initial state */
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  currentFlow: null,
  hasUnsavedChanges: false,
  flowLoading: false,
  flowError: null,
  flows: [],
  flowsLoading: false,
  flowsError: null,
  validationResult: null,
  validating: false,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for nodes and connections
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new empty flow
 */
const createEmptyFlow = (name: string, description?: string): FlowDefinition => ({
  id: generateId(),
  name,
  description,
  nodes: [],
  connections: [],
  status: FlowStatus.DRAFT,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * Create a new node instance from a node type
 */
const createNodeInstance = (
  nodeType: NodeType, 
  position: { x: number; y: number }
): NodeInstance => ({
  id: generateId(),
  typeId: nodeType.id,
  label: nodeType.name,
  position,
  data: {
    settings: {},
    inputs: {},
    disabled: false,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ============================================================================
// FLOW STORE IMPLEMENTATION
// ============================================================================

export const useFlowStore = create<FlowStoreState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========== FLOW MANAGEMENT ==========
      
      /**
       * Create a new empty flow and set it as current
       */
      createNewFlow: (name: string, description?: string) => {
        const newFlow = createEmptyFlow(name, description);
        set({ 
          currentFlow: newFlow, 
          hasUnsavedChanges: true,
          validationResult: null 
        });
      },

      /**
       * Load an existing flow by ID
       */
      loadFlow: async (flowId: string) => {
        set({ flowLoading: true, flowError: null });
        
        try {
          // TODO: Replace with actual API call when backend is ready
          // const flow = await flowService.getFlow(flowId);
          
          // Mock data for development
          const mockFlow: FlowDefinition = {
            id: flowId,
            name: 'Sample Instagram Flow',
            description: 'Auto-reply to Instagram comments',
            nodes: [],
            connections: [],
            status: FlowStatus.DRAFT,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set({ 
            currentFlow: mockFlow, 
            hasUnsavedChanges: false,
            flowLoading: false,
            validationResult: null 
          });
          
        } catch (error) {
          set({ 
            flowLoading: false, 
            flowError: error instanceof Error ? error.message : 'Failed to load flow' 
          });
        }
      },

      /**
       * Save the current flow
       */
      saveFlow: async () => {
        const { currentFlow } = get();
        if (!currentFlow) return;
        
        set({ flowLoading: true, flowError: null });
        
        try {
          // TODO: Replace with actual API call when backend is ready
          // const savedFlow = await flowService.saveFlow(currentFlow);
          
          // Mock save operation
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const savedFlow: FlowDefinition = {
            ...currentFlow,
            updatedAt: new Date(),
            version: currentFlow.version + 1
          };
          
          set({ 
            currentFlow: savedFlow,
            hasUnsavedChanges: false,
            flowLoading: false 
          });
          
        } catch (error) {
          set({ 
            flowLoading: false, 
            flowError: error instanceof Error ? error.message : 'Failed to save flow' 
          });
        }
      },

      /**
       * Save the current flow with a new name (Save As)
       */
      saveFlowAs: async (name: string, description?: string) => {
        const { currentFlow } = get();
        if (!currentFlow) return;
        
        const newFlow: FlowDefinition = {
          ...currentFlow,
          id: generateId(),
          name,
          description,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set({ flowLoading: true, flowError: null });
        
        try {
          // TODO: Replace with actual API call when backend is ready
          // const savedFlow = await flowService.createFlow(newFlow);
          
          // Mock save operation
          await new Promise(resolve => setTimeout(resolve, 500));
          
          set({ 
            currentFlow: newFlow,
            hasUnsavedChanges: false,
            flowLoading: false 
          });
          
        } catch (error) {
          set({ 
            flowLoading: false, 
            flowError: error instanceof Error ? error.message : 'Failed to save flow' 
          });
        }
      },

      /**
       * Load all user flows
       */
      loadFlows: async () => {
        set({ flowsLoading: true, flowsError: null });
        
        try {
          // TODO: Replace with actual API call when backend is ready
          // const flows = await flowService.getFlows();
          
          // Mock data for development
          const mockFlows: FlowDefinition[] = [
            {
              id: 'flow-1',
              name: 'Instagram Auto-Reply',
              description: 'Automatically reply to Instagram comments',
              nodes: [],
              connections: [],
              status: FlowStatus.ACTIVE,
              version: 3,
              createdAt: new Date('2024-01-15'),
              updatedAt: new Date('2024-01-20'),
            },
            {
              id: 'flow-2',
              name: 'Customer Support Flow',
              description: 'Handle customer inquiries with AI',
              nodes: [],
              connections: [],
              status: FlowStatus.DRAFT,
              version: 1,
              createdAt: new Date('2024-01-18'),
              updatedAt: new Date('2024-01-18'),
            }
          ];
          
          set({ 
            flows: mockFlows, 
            flowsLoading: false 
          });
          
        } catch (error) {
          set({ 
            flowsLoading: false, 
            flowsError: error instanceof Error ? error.message : 'Failed to load flows' 
          });
        }
      },

      /**
       * Delete a flow
       */
      deleteFlow: async (flowId: string) => {
        try {
          // TODO: Replace with actual API call when backend is ready
          // await flowService.deleteFlow(flowId);
          
          // Mock delete operation
          await new Promise(resolve => setTimeout(resolve, 300));
          
          set(state => ({
            flows: state.flows.filter(flow => flow.id !== flowId),
            currentFlow: state.currentFlow?.id === flowId ? null : state.currentFlow
          }));
          
        } catch (error) {
          set({ 
            flowsError: error instanceof Error ? error.message : 'Failed to delete flow' 
          });
        }
      },

      /**
       * Deploy/activate a flow
       */
      deployFlow: async (flowId: string) => {
        try {
          // TODO: Replace with actual API call when backend is ready
          // await flowService.deployFlow(flowId);
          
          // Mock deploy operation
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          set(state => ({
            flows: state.flows.map(flow => 
              flow.id === flowId 
                ? { ...flow, status: FlowStatus.ACTIVE, updatedAt: new Date() }
                : flow
            ),
            currentFlow: state.currentFlow?.id === flowId 
              ? { ...state.currentFlow, status: FlowStatus.ACTIVE, updatedAt: new Date() }
              : state.currentFlow
          }));
          
        } catch (error) {
          set({ 
            flowError: error instanceof Error ? error.message : 'Failed to deploy flow' 
          });
        }
      },

      /**
       * Deactivate a flow
       */
      deactivateFlow: async (flowId: string) => {
        try {
          // TODO: Replace with actual API call when backend is ready
          // await flowService.deactivateFlow(flowId);
          
          // Mock deactivate operation
          await new Promise(resolve => setTimeout(resolve, 500));
          
          set(state => ({
            flows: state.flows.map(flow => 
              flow.id === flowId 
                ? { ...flow, status: FlowStatus.INACTIVE, updatedAt: new Date() }
                : flow
            ),
            currentFlow: state.currentFlow?.id === flowId 
              ? { ...state.currentFlow, status: FlowStatus.INACTIVE, updatedAt: new Date() }
              : state.currentFlow
          }));
          
        } catch (error) {
          set({ 
            flowError: error instanceof Error ? error.message : 'Failed to deactivate flow' 
          });
        }
      },

      // ========== NODE MANAGEMENT ==========
      
      /**
       * Add a new node instance to the current flow
       */
      addNode: (nodeType: NodeType, position: { x: number; y: number }) => {
        const { currentFlow } = get();
        if (!currentFlow) throw new Error('No active flow');
        
        const newNode = createNodeInstance(nodeType, position);
        
        set(state => ({
          currentFlow: state.currentFlow ? {
            ...state.currentFlow,
            nodes: [...state.currentFlow.nodes, newNode],
            updatedAt: new Date()
          } : null,
          hasUnsavedChanges: true,
          validationResult: null
        }));
        
        return newNode;
      },

      /**
       * Remove a node from the current flow
       */
      removeNode: (nodeId: string) => {
        const { currentFlow } = get();
        if (!currentFlow) return;
        
        set(state => ({
          currentFlow: state.currentFlow ? {
            ...state.currentFlow,
            nodes: state.currentFlow.nodes.filter(node => node.id !== nodeId),
            connections: state.currentFlow.connections.filter(
              conn => conn.sourceNodeId !== nodeId && conn.targetNodeId !== nodeId
            ),
            updatedAt: new Date()
          } : null,
          hasUnsavedChanges: true,
          validationResult: null
        }));
      },

      /**
       * Update a node instance
       */
      updateNode: (nodeId: string, updates: Partial<NodeInstance>) => {
        const { currentFlow } = get();
        if (!currentFlow) return;
        
        set(state => ({
          currentFlow: state.currentFlow ? {
            ...state.currentFlow,
            nodes: state.currentFlow.nodes.map(node =>
              node.id === nodeId 
                ? { ...node, ...updates, updatedAt: new Date() }
                : node
            ),
            updatedAt: new Date()
          } : null,
          hasUnsavedChanges: true,
          validationResult: null
        }));
      },

      /**
       * Update node position
       */
      updateNodePosition: (nodeId: string, position: { x: number; y: number }) => {
        get().updateNode(nodeId, { position });
      },

      /**
       * Update node settings
       */
      updateNodeSettings: (nodeId: string, settings: Record<string, any>) => {
        const { currentFlow } = get();
        if (!currentFlow) return;
        
        const node = currentFlow.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        get().updateNode(nodeId, {
          data: {
            ...node.data,
            settings: { ...node.data.settings, ...settings }
          }
        });
      },

      /**
       * Get a node by ID
       */
      getNode: (nodeId: string) => {
        const { currentFlow } = get();
        return currentFlow?.nodes.find(node => node.id === nodeId);
      },

      // ========== CONNECTION MANAGEMENT ==========
      
      /**
       * Add a connection between two nodes
       */
      addConnection: (connectionData: Omit<NodeConnection, 'id'>) => {
        const { currentFlow } = get();
        if (!currentFlow) throw new Error('No active flow');
        
        const newConnection: NodeConnection = {
          ...connectionData,
          id: generateId()
        };
        
        set(state => ({
          currentFlow: state.currentFlow ? {
            ...state.currentFlow,
            connections: [...state.currentFlow.connections, newConnection],
            updatedAt: new Date()
          } : null,
          hasUnsavedChanges: true,
          validationResult: null
        }));
        
        return newConnection;
      },

      /**
       * Remove a connection
       */
      removeConnection: (connectionId: string) => {
        const { currentFlow } = get();
        if (!currentFlow) return;
        
        set(state => ({
          currentFlow: state.currentFlow ? {
            ...state.currentFlow,
            connections: state.currentFlow.connections.filter(
              conn => conn.id !== connectionId
            ),
            updatedAt: new Date()
          } : null,
          hasUnsavedChanges: true,
          validationResult: null
        }));
      },

      /**
       * Get all connections for a specific node
       */
      getNodeConnections: (nodeId: string) => {
        const { currentFlow } = get();
        if (!currentFlow) return [];
        
        return currentFlow.connections.filter(
          conn => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId
        );
      },

      /**
       * Get incoming connections for a node
       */
      getIncomingConnections: (nodeId: string) => {
        const { currentFlow } = get();
        if (!currentFlow) return [];
        
        return currentFlow.connections.filter(
          conn => conn.targetNodeId === nodeId
        );
      },

      /**
       * Get outgoing connections for a node
       */
      getOutgoingConnections: (nodeId: string) => {
        const { currentFlow } = get();
        if (!currentFlow) return [];
        
        return currentFlow.connections.filter(
          conn => conn.sourceNodeId === nodeId
        );
      },

      // ========== VALIDATION ==========
      
      /**
       * Validate the current flow
       */
      validateFlow: async () => {
        const { currentFlow } = get();
        if (!currentFlow) {
          const result: FlowValidationResult = {
            isValid: false,
            errors: [{ 
              nodeId: '', 
              type: 'execution', 
              message: 'No flow to validate', 
              severity: 'error' 
            }],
            warnings: []
          };
          set({ validationResult: result });
          return result;
        }
        
        set({ validating: true });
        
        try {
          // TODO: Replace with actual validation logic
          const errors: NodeValidationError[] = [];
          const warnings: NodeValidationError[] = [];
          
          // Basic validation checks
          if (currentFlow.nodes.length === 0) {
            errors.push({
              nodeId: '',
              type: 'execution',
              message: 'Flow must contain at least one node',
              severity: 'error'
            });
          }
          
          // Check for disconnected nodes
          currentFlow.nodes.forEach(node => {
            const connections = get().getNodeConnections(node.id);
            if (connections.length === 0 && currentFlow.nodes.length > 1) {
              warnings.push({
                nodeId: node.id,
                type: 'connection',
                message: 'Node is not connected to any other nodes',
                severity: 'warning'
              });
            }
          });
          
          const result: FlowValidationResult = {
            isValid: errors.length === 0,
            errors,
            warnings
          };
          
          set({ validationResult: result, validating: false });
          return result;
          
        } catch (error) {
          const result: FlowValidationResult = {
            isValid: false,
            errors: [{
              nodeId: '',
              type: 'execution',
              message: error instanceof Error ? error.message : 'Validation failed',
              severity: 'error'
            }],
            warnings: []
          };
          
          set({ validationResult: result, validating: false });
          return result;
        }
      },

      /**
       * Clear validation results
       */
      clearValidation: () => {
        set({ validationResult: null });
      },

      // ========== UTILITY ==========
      
      /**
       * Mark flow as having unsaved changes
       */
      markAsChanged: () => {
        set({ hasUnsavedChanges: true });
      },

      /**
       * Clear unsaved changes flag
       */
      markAsSaved: () => {
        set({ hasUnsavedChanges: false });
      },

      /**
       * Reset store to initial state
       */
      reset: () => {
        set(initialState);
      }
    }),
    {
      name: 'flow-store', // Name for Redux DevTools
    }
  )
);
