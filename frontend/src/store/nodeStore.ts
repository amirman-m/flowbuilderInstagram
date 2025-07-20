import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  NodeType, 
  NodeCategory, 
  NodeTypeFilter, 
  NodeInstance,
  NodeExecutionResult,
  NodeExecutionOptions 
} from '../types/nodes';

// ============================================================================
// NODE STORE STATE INTERFACE
// ============================================================================

interface NodeStoreState {
  // ========== NODE TYPES MANAGEMENT ==========
  /** All available node types loaded from the backend */
  nodeTypes: NodeType[];
  
  /** Loading state for node types */
  nodeTypesLoading: boolean;
  
  /** Error state for node types loading */
  nodeTypesError: string | null;
  
  /** Currently selected node type in the palette */
  selectedNodeType: NodeType | null;
  
  /** Filter applied to node types list */
  nodeTypeFilter: NodeTypeFilter;
  
  // ========== NODE EXECUTION MANAGEMENT ==========
  /** Currently executing nodes (nodeId -> execution status) */
  executingNodes: Map<string, NodeExecutionResult>;
  
  /** Execution history for nodes */
  executionHistory: Map<string, NodeExecutionResult[]>;
  
  // ========== ACTIONS ==========
  /** Load all available node types from backend */
  loadNodeTypes: () => Promise<void>;
  
  /** Get node types filtered by current filter */
  getFilteredNodeTypes: () => NodeType[];
  
  /** Get node types by category */
  getNodeTypesByCategory: (category: NodeCategory) => NodeType[];
  
  /** Get a specific node type by ID */
  getNodeType: (typeId: string) => NodeType | undefined;
  
  /** Set the currently selected node type */
  setSelectedNodeType: (nodeType: NodeType | null) => void;
  
  /** Update node type filter */
  setNodeTypeFilter: (filter: Partial<NodeTypeFilter>) => void;
  
  /** Clear node type filter */
  clearNodeTypeFilter: () => void;
  
  /** Execute a single node for testing */
  executeNode: (nodeInstance: NodeInstance, options?: NodeExecutionOptions) => Promise<NodeExecutionResult>;
  
  /** Get execution status for a node */
  getNodeExecutionStatus: (nodeId: string) => NodeExecutionResult | undefined;
  
  /** Get execution history for a node */
  getNodeExecutionHistory: (nodeId: string) => NodeExecutionResult[];
  
  /** Clear execution history */
  clearExecutionHistory: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  nodeTypes: [],
  nodeTypesLoading: false,
  nodeTypesError: null,
  selectedNodeType: null,
  nodeTypeFilter: {},
  executingNodes: new Map(),
  executionHistory: new Map(),
};

// ============================================================================
// NODE STORE IMPLEMENTATION
// ============================================================================

export const useNodeStore = create<NodeStoreState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========== NODE TYPES LOADING ==========
      
      /**
       * Load all available node types from the backend
       * This should be called when the app initializes or when node types need refreshing
       */
      loadNodeTypes: async () => {
        set({ nodeTypesLoading: true, nodeTypesError: null });
        
        try {
          // TODO: Replace with actual API call when backend is ready
          // const nodeTypes = await nodeService.getNodeTypes();
          
          // Mock data for development - this will be replaced with real API call
          const mockNodeTypes: NodeType[] = [
            {
              id: 'instagram-comment-trigger',
              name: 'Instagram Comment Trigger',
              description: 'Triggers when a new comment is received on Instagram',
              category: NodeCategory.TRIGGER,
              version: '1.0.0',
              icon: 'comment',
              color: '#E4405F',
              ports: {
                inputs: [],
                outputs: [
                  {
                    id: 'comment-data',
                    name: 'commentData',
                    label: 'Comment Data',
                    description: 'The received comment data',
                    dataType: 'object' as any,
                    required: true
                  }
                ]
              },
              settingsSchema: {
                type: 'object',
                properties: {
                  postId: {
                    type: 'string',
                    title: 'Post ID',
                    description: 'Instagram post ID to monitor'
                  },
                  keywords: {
                    type: 'array',
                    title: 'Keywords',
                    description: 'Keywords to filter comments',
                    items: { type: 'string' }
                  }
                },
                required: ['postId']
              },
              tags: ['instagram', 'social-media', 'trigger']
            },
            {
              id: 'llm-response-processor',
              name: 'LLM Response Generator',
              description: 'Generates AI responses using Large Language Models',
              category: NodeCategory.PROCESSOR,
              version: '1.0.0',
              icon: 'brain',
              color: '#10B981',
              ports: {
                inputs: [
                  {
                    id: 'input-text',
                    name: 'inputText',
                    label: 'Input Text',
                    description: 'Text to process with LLM',
                    dataType: 'string' as any,
                    required: true
                  },
                  {
                    id: 'context',
                    name: 'context',
                    label: 'Context',
                    description: 'Additional context for the LLM',
                    dataType: 'object' as any,
                    required: false
                  }
                ],
                outputs: [
                  {
                    id: 'response',
                    name: 'response',
                    label: 'Generated Response',
                    description: 'AI-generated response text',
                    dataType: 'string' as any,
                    required: true
                  }
                ]
              },
              settingsSchema: {
                type: 'object',
                properties: {
                  model: {
                    type: 'string',
                    title: 'Model',
                    description: 'LLM model to use',
                    enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-3'],
                    default: 'gpt-4'
                  },
                  temperature: {
                    type: 'number',
                    title: 'Temperature',
                    description: 'Creativity level (0-1)',
                    minimum: 0,
                    maximum: 1,
                    default: 0.7
                  },
                  maxTokens: {
                    type: 'integer',
                    title: 'Max Tokens',
                    description: 'Maximum response length',
                    minimum: 1,
                    maximum: 4000,
                    default: 500
                  },
                  systemPrompt: {
                    type: 'string',
                    title: 'System Prompt',
                    description: 'Instructions for the AI'
                  }
                },
                required: ['model', 'systemPrompt']
              },
              tags: ['ai', 'llm', 'text-generation']
            },
            {
              id: 'instagram-reply-action',
              name: 'Instagram Reply',
              description: 'Sends a reply to an Instagram comment',
              category: NodeCategory.ACTION,
              version: '1.0.0',
              icon: 'reply',
              color: '#F59E0B',
              ports: {
                inputs: [
                  {
                    id: 'comment-id',
                    name: 'commentId',
                    label: 'Comment ID',
                    description: 'ID of the comment to reply to',
                    dataType: 'string' as any,
                    required: true
                  },
                  {
                    id: 'reply-text',
                    name: 'replyText',
                    label: 'Reply Text',
                    description: 'Text content of the reply',
                    dataType: 'string' as any,
                    required: true
                  }
                ],
                outputs: [
                  {
                    id: 'success',
                    name: 'success',
                    label: 'Success',
                    description: 'Whether the reply was sent successfully',
                    dataType: 'boolean' as any,
                    required: true
                  }
                ]
              },
              settingsSchema: {
                type: 'object',
                properties: {
                  accessToken: {
                    type: 'string',
                    title: 'Access Token',
                    description: 'Instagram API access token'
                  },
                  delay: {
                    type: 'integer',
                    title: 'Delay (seconds)',
                    description: 'Delay before sending reply',
                    minimum: 0,
                    default: 0
                  }
                },
                required: ['accessToken']
              },
              tags: ['instagram', 'social-media', 'action']
            }
          ];
          
          set({ 
            nodeTypes: mockNodeTypes, 
            nodeTypesLoading: false, 
            nodeTypesError: null 
          });
          
        } catch (error) {
          set({ 
            nodeTypesLoading: false, 
            nodeTypesError: error instanceof Error ? error.message : 'Failed to load node types' 
          });
        }
      },

      // ========== NODE TYPE FILTERING AND SELECTION ==========
      
      /**
       * Get node types filtered by current filter settings
       */
      getFilteredNodeTypes: () => {
        const { nodeTypes, nodeTypeFilter } = get();
        
        return nodeTypes.filter(nodeType => {
          // Filter by category
          if (nodeTypeFilter.category && nodeType.category !== nodeTypeFilter.category) {
            return false;
          }
          
          // Filter by search term
          if (nodeTypeFilter.search) {
            const searchTerm = nodeTypeFilter.search.toLowerCase();
            const matchesName = nodeType.name.toLowerCase().includes(searchTerm);
            const matchesDescription = nodeType.description.toLowerCase().includes(searchTerm);
            const matchesTags = nodeType.tags?.some(tag => 
              tag.toLowerCase().includes(searchTerm)
            );
            
            if (!matchesName && !matchesDescription && !matchesTags) {
              return false;
            }
          }
          
          // Filter by tags
          if (nodeTypeFilter.tags && nodeTypeFilter.tags.length > 0) {
            const hasMatchingTag = nodeTypeFilter.tags.some(filterTag =>
              nodeType.tags?.includes(filterTag)
            );
            if (!hasMatchingTag) {
              return false;
            }
          }
          
          // Filter deprecated nodes
          if (!nodeTypeFilter.includeDeprecated && nodeType.deprecated) {
            return false;
          }
          
          return true;
        });
      },

      /**
       * Get node types by specific category
       */
      getNodeTypesByCategory: (category: NodeCategory) => {
        const { nodeTypes } = get();
        return nodeTypes.filter(nodeType => nodeType.category === category);
      },

      /**
       * Get a specific node type by its ID
       */
      getNodeType: (typeId: string) => {
        const { nodeTypes } = get();
        return nodeTypes.find(nodeType => nodeType.id === typeId);
      },

      /**
       * Set the currently selected node type (for palette selection)
       */
      setSelectedNodeType: (nodeType: NodeType | null) => {
        set({ selectedNodeType: nodeType });
      },

      /**
       * Update the node type filter
       */
      setNodeTypeFilter: (filter: Partial<NodeTypeFilter>) => {
        set(state => ({
          nodeTypeFilter: { ...state.nodeTypeFilter, ...filter }
        }));
      },

      /**
       * Clear all node type filters
       */
      clearNodeTypeFilter: () => {
        set({ nodeTypeFilter: {} });
      },

      // ========== NODE EXECUTION MANAGEMENT ==========
      
      /**
       * Execute a single node for testing purposes
       */
      executeNode: async (nodeInstance: NodeInstance, options?: NodeExecutionOptions) => {
        const executionId = `${nodeInstance.id}-${Date.now()}`;
        
        // Create initial execution result
        const executionResult: NodeExecutionResult = {
          status: 'running' as any,
          outputs: {},
          startedAt: new Date(),
          metadata: { executionId, testMode: options?.testMode || false }
        };
        
        // Update executing nodes map
        set(state => ({
          executingNodes: new Map(state.executingNodes.set(nodeInstance.id, executionResult))
        }));
        
        try {
          // TODO: Replace with actual API call when backend is ready
          // const result = await nodeService.executeNode(nodeInstance, options);
          
          // Mock execution for development
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
          
          const finalResult: NodeExecutionResult = {
            ...executionResult,
            status: 'success' as any,
            outputs: { result: 'Mock execution completed successfully' },
            completedAt: new Date()
          };
          
          // Update state with completed execution
          set(state => {
            const newExecutingNodes = new Map(state.executingNodes);
            newExecutingNodes.delete(nodeInstance.id);
            
            const nodeHistory = state.executionHistory.get(nodeInstance.id) || [];
            const newExecutionHistory = new Map(state.executionHistory);
            newExecutionHistory.set(nodeInstance.id, [...nodeHistory, finalResult]);
            
            return {
              executingNodes: newExecutingNodes,
              executionHistory: newExecutionHistory
            };
          });
          
          return finalResult;
          
        } catch (error) {
          const errorResult: NodeExecutionResult = {
            ...executionResult,
            status: 'error' as any,
            error: error instanceof Error ? error.message : 'Execution failed',
            completedAt: new Date()
          };
          
          // Update state with error
          set(state => {
            const newExecutingNodes = new Map(state.executingNodes);
            newExecutingNodes.delete(nodeInstance.id);
            
            const nodeHistory = state.executionHistory.get(nodeInstance.id) || [];
            const newExecutionHistory = new Map(state.executionHistory);
            newExecutionHistory.set(nodeInstance.id, [...nodeHistory, errorResult]);
            
            return {
              executingNodes: newExecutingNodes,
              executionHistory: newExecutionHistory
            };
          });
          
          return errorResult;
        }
      },

      /**
       * Get current execution status for a node
       */
      getNodeExecutionStatus: (nodeId: string) => {
        const { executingNodes } = get();
        return executingNodes.get(nodeId);
      },

      /**
       * Get execution history for a specific node
       */
      getNodeExecutionHistory: (nodeId: string) => {
        const { executionHistory } = get();
        return executionHistory.get(nodeId) || [];
      },

      /**
       * Clear all execution history
       */
      clearExecutionHistory: () => {
        set({ executionHistory: new Map(), executingNodes: new Map() });
      }
    }),
    {
      name: 'node-store', // Name for Redux DevTools
    }
  )
);
