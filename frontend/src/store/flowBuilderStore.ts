import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Node, Edge } from '@xyflow/react';
import { NodeType, NodeInstance } from '../types/nodes';
import { Flow } from '../types';

// ============================================================================
// FLOW BUILDER STORE STATE INTERFACE
// ============================================================================

interface FlowBuilderState {
  // ========== FLOW DATA ==========
  /** Current flow being edited */
  flow: Flow | null;
  /** Flow name for editing */
  flowName: string;
  /** Whether flow name is being edited */
  isEditingName: boolean;
  /** Whether flow name is being saved */
  nameSaving: boolean;
  
  // ========== LOADING STATES ==========
  /** Whether flow is loading */
  loading: boolean;
  /** Whether flow is being saved */
  saving: boolean;
  
  // ========== REACT FLOW STATE ==========
  /** React Flow nodes */
  nodes: Node[];
  /** React Flow edges */
  edges: Edge[];
  /** Available node types from backend */
  availableNodeTypes: NodeType[];
  
  // ========== NODE INSPECTOR ==========
  /** Currently selected node instance */
  selectedNode: NodeInstance | null;
  /** Selected node type */
  selectedNodeType: NodeType | null;
  /** Whether inspector is open */
  inspectorOpen: boolean;
  
  // ========== FLOW EXECUTION ==========
  /** Whether execution dialog is open */
  executionDialogOpen: boolean;
  /** Trigger node ID for execution */
  triggerNodeId: string | null;
  /** Trigger node type for execution */
  triggerNodeType: string | null;
  /** Execution results for nodes */
  executionState: Record<string, any>;
  
  // ========== ACTIONS ==========
  
  // --- Flow Management ---
  setFlow: (flow: Flow | null) => void;
  setFlowName: (name: string) => void;
  setIsEditingName: (editing: boolean) => void;
  setNameSaving: (saving: boolean) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  
  // --- Node Management ---
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  setAvailableNodeTypes: (types: NodeType[]) => void;
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: any) => void;
  deleteNode: (nodeId: string) => void;
  
  // --- Inspector Management ---
  setSelectedNode: (node: NodeInstance | null) => void;
  setSelectedNodeType: (nodeType: NodeType | null) => void;
  setInspectorOpen: (open: boolean) => void;
  
  // --- Execution Management ---
  setExecutionDialogOpen: (open: boolean) => void;
  setTriggerNodeId: (nodeId: string | null) => void;
  setTriggerNodeType: (nodeType: string | null) => void;
  syncExecutionResults: (results: Record<string, any>) => void;
  
  // --- Utility ---
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  flow: null,
  flowName: '',
  isEditingName: false,
  nameSaving: false,
  loading: true,
  saving: false,
  nodes: [],
  edges: [],
  availableNodeTypes: [],
  selectedNode: null,
  selectedNodeType: null,
  inspectorOpen: false,
  executionDialogOpen: false,
  triggerNodeId: null,
  triggerNodeType: null,
  executionState: {},
};

// ============================================================================
// FLOW BUILDER STORE IMPLEMENTATION
// ============================================================================

export const useFlowBuilderStore = create<FlowBuilderState>()(
  devtools(
    (set) => ({
      ...initialState,

      // ========== FLOW MANAGEMENT ==========
      
      setFlow: (flow: Flow | null) => {
        set({ flow });
        if (flow) {
          set({ flowName: flow.name });
        }
      },

      setFlowName: (flowName: string) => {
        set({ flowName });
      },

      setIsEditingName: (isEditingName: boolean) => {
        set({ isEditingName });
      },

      setNameSaving: (nameSaving: boolean) => {
        set({ nameSaving });
      },

      setLoading: (loading: boolean) => {
        set({ loading });
      },

      setSaving: (saving: boolean) => {
        set({ saving });
      },

      // ========== NODE MANAGEMENT ==========
      
      setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => {
        if (typeof nodes === 'function') {
          set(state => ({ nodes: nodes(state.nodes) }));
        } else {
          set({ nodes });
        }
      },

      setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => {
        if (typeof edges === 'function') {
          set(state => ({ edges: edges(state.edges) }));
        } else {
          set({ edges });
        }
      },

      setAvailableNodeTypes: (availableNodeTypes: NodeType[]) => {
        set({ availableNodeTypes });
      },

      addNode: (node: Node) => {
        set(state => ({
          nodes: [...state.nodes, node]
        }));
      },

      updateNode: (nodeId: string, updates: any) => {
        console.log('🔄 Updating node in store:', nodeId, updates);
        
        set(state => ({
          nodes: state.nodes.map(node => {
            if (node.id === nodeId) {
              const nodeData = node.data as any;
              
              // Handle execution results update
              if (updates.data?.lastExecution) {
                console.log('📊 Updating node execution results in store:', updates.data.lastExecution);
                
                const updatedNode = {
                  ...node,
                  data: {
                    ...nodeData,
                    instance: {
                      ...(nodeData.instance || {}),
                      data: {
                        ...(nodeData.instance?.data || {}),
                        lastExecution: updates.data.lastExecution,
                        ...(updates.data.inputs ? { inputs: updates.data.inputs } : {})
                      }
                    }
                  }
                };
                
                // Update selected node if this is the one being updated
                if (state.selectedNode?.id === nodeId) {
                  const updatedInstance: NodeInstance = {
                    ...(updatedNode.data as any).instance,
                    data: {
                      ...((updatedNode.data as any).instance?.data || {}),
                      lastExecution: updates.data.lastExecution,
                      ...(updates.data.inputs ? { inputs: updates.data.inputs } : {})
                    }
                  };
                  
                  // Update selected node and open inspector if not already open
                  if (!state.inspectorOpen) {
                    set({
                      selectedNode: updatedInstance,
                      selectedNodeType: (updatedNode.data as any).nodeType,
                      inspectorOpen: true
                    });
                  } else {
                    set({ selectedNode: updatedInstance });
                  }
                }
                
                return updatedNode;
              }
              
              // Handle settings updates
              if (updates.data?.settings) {
                console.log('⚙️ Updating node settings in store:', updates.data.settings);
                
                const updatedNode = {
                  ...node,
                  data: {
                    ...nodeData,
                    instance: {
                      ...(nodeData.instance || {}),
                      data: {
                        ...(nodeData.instance?.data || {}),
                        settings: updates.data.settings
                      }
                    }
                  }
                };
                
                // Update selected node to maintain inspector state
                if (state.selectedNode?.id === nodeId) {
                  const updatedInstance = (updatedNode.data as any).instance as NodeInstance;
                  set({ selectedNode: updatedInstance });
                }
                
                return updatedNode;
              }
              
              // Handle other updates
              return {
                ...node,
                data: {
                  ...nodeData,
                  instance: {
                    ...(nodeData.instance || {}),
                    ...updates
                  }
                }
              };
            }
            return node;
          })
        }));
      },

      deleteNode: (nodeId: string) => {
        set(state => ({
          nodes: state.nodes.filter(node => node.id !== nodeId),
          edges: state.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId),
          // Close inspector if deleted node was selected
          ...(state.selectedNode?.id === nodeId ? {
            inspectorOpen: false,
            selectedNode: null,
            selectedNodeType: null
          } : {})
        }));
      },

      // ========== INSPECTOR MANAGEMENT ==========
      
      setSelectedNode: (selectedNode: NodeInstance | null) => {
        set({ selectedNode });
      },

      setSelectedNodeType: (selectedNodeType: NodeType | null) => {
        set({ selectedNodeType });
      },

      setInspectorOpen: (inspectorOpen: boolean) => {
        set({ inspectorOpen });
      },

      // ========== EXECUTION MANAGEMENT ==========
      
      setExecutionDialogOpen: (executionDialogOpen: boolean) => {
        set({ executionDialogOpen });
      },

      setTriggerNodeId: (triggerNodeId: string | null) => {
        set({ triggerNodeId });
      },

      setTriggerNodeType: (triggerNodeType: string | null) => {
        set({ triggerNodeType });
      },

      syncExecutionResults: (results: Record<string, any>) => {
        console.log('🔄 Syncing execution results in store:', results);
        
        set(state => ({
          executionState: { ...state.executionState, ...results },
          nodes: state.nodes.map(node => {
            const nodeId = node.id;
            const executionResult = results[nodeId];
            
            if (executionResult && executionResult.outputs) {
              console.log(`📝 Updating node ${nodeId} with outputs in store:`, executionResult.outputs);
              
              const currentData = (node.data as any) || {};
              
              return {
                ...node,
                data: {
                  ...currentData,
                  executionResult: executionResult,
                  outputs: executionResult.outputs,
                  status: executionResult.status,
                  executionTime: executionResult.execution_time_ms,
                  lastExecuted: executionResult.completed_at,
                  instance: currentData.instance
                }
              };
            }
            
            return node;
          })
        }));
      },

      // ========== UTILITY ==========
      
      reset: () => {
        set(initialState);
      }
    }),
    {
      name: 'flow-builder-store', // Name for Redux DevTools
    }
  )
);

export default useFlowBuilderStore;
