import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,

  Chip,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useReactFlow,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Flow } from '../types';
import { NodeType, NodeCategory, NodeInstance, NodeConnection, NodeDataType } from '../types/nodes';
import { flowsAPI } from '../services/api';
import { nodeService } from '../services/nodeService';
import { NodeComponentFactory } from '../components/nodes/NodeComponentFactory';
import { edgeTypes } from '../components/edges/CustomEdge';
import { NodeInspector } from '../components/inspector';
import { FlowExecutionDialog } from '../components/dialogs/FlowExecutionDialog';
import { NODE_REGISTRY } from '../config/nodeRegistry';
import { useConnectionValidation } from '../hooks/useConnectionValidation';
import '../styles/connectionValidation.css';

// Define nodeTypes using our NodeComponentFactory for all node types
const nodeTypes = {
  customNode: NodeComponentFactory
};

// Inner FlowBuilder component that uses React Flow hooks
const FlowBuilderInner: React.FC = () => {
  // Local editable name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [availableNodeTypes, setAvailableNodeTypes] = useState<NodeType[]>([]);
  
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);

  // When node types are loaded, ensure all existing nodes have their nodeType attached
  // AND retry loading flow if it was waiting for node types
  useEffect(() => {
    if (availableNodeTypes.length === 0 || nodes.length === 0) return;
    let updated = false;
    setNodes((nds) =>
      nds.map((n) => {
        const nData: any = n.data ?? {};
        if (!nData.nodeType) {
          const nt = availableNodeTypes.find((t) => t.id === nData.instance?.typeId);
          if (nt) {
            updated = true;
            return {
              ...n,
              data: { ...nData, nodeType: nt },
            };
          }
        }
        return n;
      }),
    );

    // If we enriched any nodes, reapply edges so React Flow revalidates them
    if (updated) {
      setEdges((es) => es.map((e) => ({ ...e })));
    }
  }, [availableNodeTypes, flowId, nodes.length, loading]);
  
  // First declare the mapConnection without the onEdgeDelete handler
  const mapConnection = useCallback((c: NodeConnection): Edge => ({
    id: c.id,
    source: c.sourceNodeId,
    target: c.targetNodeId,
    sourceHandle: c.sourcePortId,
    targetHandle: c.targetPortId,
    type: 'custom',
  }), []);

  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  
  // Now define onEdgeDelete after setEdges is available
  const onEdgeDelete = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  }, [setEdges]);
  
  // Helper to attach onEdgeDelete to edges
  const attachEdgeHandlers = useCallback((edge: Edge): Edge => {
    return {
      ...edge,
      data: { ...edge.data, onEdgeDelete }
    };
  }, [onEdgeDelete]);
  
  // Create a map of node types for validation
  const nodeTypesMap = useMemo(() => {
    const map: Record<string, NodeType> = {};
    availableNodeTypes.forEach(nodeType => {
      map[nodeType.id] = nodeType;
    });
    return map;
  }, [availableNodeTypes]);
  
  // Initialize connection validation
  const {
    validateConnection,
    isConnectionValid,
    getValidatedEdges,
    onConnect: handleConnect,
    isValidConnection,
    getConnectionError
  } = useConnectionValidation(nodes, nodeTypesMap, {
    realTimeValidation: true,
    preventInvalidConnections: true
  });
  
  // Handle new connections with validation
  const onConnect = useCallback((connection: Connection) => {
    console.log('🔗 Attempting to create connection:', connection);
    
    // Validate the connection
    const validationResult = validateConnection(connection);
    
    if (!validationResult.isValid) {
      console.warn('❌ Connection blocked:', validationResult.errorMessage);
      // Show user-friendly error message
      alert(validationResult.errorMessage || 'Invalid connection');
      return;
    }
    
    console.log('✅ Connection validated, creating edge');
    
    // Create the new edge and attach the delete handler
    const newEdge: Edge = attachEdgeHandlers({
      id: `edge_${Date.now()}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'custom',
    });
    
    // Add the edge to the flow
    setEdges((eds) => addEdge(newEdge, eds));
  }, [validateConnection, setEdges]);
  
  // Apply validation styling to edges
  const validatedEdges = useMemo(() => {
    return getValidatedEdges(edges);
  }, [getValidatedEdges, edges]);
  
  // Node Inspector state
  const [selectedNode, setSelectedNode] = useState<NodeInstance | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  
  // Flow execution state
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [triggerNodeId, setTriggerNodeId] = useState<string | null>(null);

  // Load node types on mount, then load the flow
  useEffect(() => {
    // This effect runs once on component mount
    loadNodeTypes();
  }, []);

  useEffect(() => {
    // This effect runs whenever flowId changes or after node types are loaded
    if (flowId && availableNodeTypes.length > 0) {
      loadFlow();
    }
  }, [flowId, availableNodeTypes]);

  const loadFlow = async () => {
    if (!flowId) {
      // If no flowId, create a new empty flow for editing
      const newFlowName = 'New Flow';
      setFlow({
        id: 'new',
        name: newFlowName,
        description: 'A new flow for social media automation',
        status: 'draft' as any,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);
      setNodes([]);
      setEdges([]);
      return;
    }
    
    try {
      setLoading(true);
      const flowData = await flowsAPI.getFlow(parseInt(flowId));
      setFlow(flowData);
      setFlowName(flowData.name);
      
      // Fetch graph from backend
      const flowNodes = await flowsAPI.getFlowNodes(parseInt(flowId));
      const flowConnections = await flowsAPI.getFlowConnections(parseInt(flowId));

      setNodes(flowNodes.map(mapNodeInstance));
      setEdges(flowConnections.map(mapConnection).map(attachEdgeHandlers));
      
      console.log('Flow loaded successfully from backend:', flowData);
    } catch (err: any) {
      // Don't set error state for flow loading failures - just log and continue
      // This allows the UI to render with empty flow and node types from backend
      console.warn('Failed to load flow from backend, starting with empty flow:', err);
      const fallbackName = `Flow ${flowId}`;
      setFlow({
        id: flowId,
        name: fallbackName,
        description: 'Flow loaded with mock data due to backend unavailability',
        status: 'draft' as any,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  };

  const loadNodeTypes = async () => {
    try {
      // Load node types from the backend
      const types = await nodeService.types.getNodeTypes(); 
      if (types && types.length > 0) {
        console.log('✅ Using backend node types:', types.map(t => t.name));
        // Temporary subcategory mapping until backend provides it
      const SUBCATEGORY_MAP: Record<string, string> = {
        // Legacy or mock IDs
        openAIChat: 'Chat Models',
        deepSeekChat: 'Chat Models',
        // Actual backend IDs
        'simple-openai-chat': 'Chat Models',
        'simple-deepseek-chat': 'Chat Models'
      };

      const enhancedTypes = types.map(t => {
        const registryEntry = NODE_REGISTRY[t.id];
        return registryEntry ? { ...t, subcategory: registryEntry.subcategory } : t;
      });

      setAvailableNodeTypes(enhancedTypes);
        return; // Exit early - backend data loaded successfully
      } else {
        // If no node types are returned from the backend, use default mock types for testing
        console.warn('⚠️ No node types returned from backend, using mock types for testing');
        
        // Create properly typed mock nodes
        const mockTriggerNode: NodeType = {
          id: 'instagram-comment',
          name: 'Instagram Comment',
          description: 'Triggers when a new Instagram comment is received',
          category: NodeCategory.TRIGGER,
          version: '1.0.0',
          icon: 'instagram',
          color: '#E1306C',
          ports: {
            inputs: [],
            outputs: [
              {
                id: 'comment',
                name: 'comment',
                label: 'Comment',
                description: 'The received comment data',
                dataType: NodeDataType.OBJECT,
                required: true
              }
            ]
          },
          settingsSchema: {
            type: 'object',
            properties: {
              accountId: {
                type: 'string',
                title: 'Instagram Account ID'
              },
              filterHashtags: {
                type: 'array',
                title: 'Filter Hashtags',
                items: {
                  type: 'string'
                }
              }
            },
            required: ['accountId']
          }
        };
        
        const mockProcessorNode: NodeType = {
          id: 'ai-response',
          name: 'AI Response Generator',
          description: 'Generates AI responses based on input text',
          category: NodeCategory.PROCESSOR,
          version: '1.0.0',
          icon: 'smart_toy',
          color: '#2196F3',
          ports: {
            inputs: [
              {
                id: 'input',
                name: 'input',
                label: 'Input Text',
                description: 'The text to process',
                dataType: NodeDataType.STRING,
                required: true
              }
            ],
            outputs: [
              {
                id: 'response',
                name: 'response',
                label: 'AI Response',
                description: 'Generated AI response',
                dataType: NodeDataType.STRING,
                required: true
              }
            ]
          },
          settingsSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                title: 'AI Model',
                enum: ['gpt-3.5-turbo', 'gpt-4'],
                default: 'gpt-3.5-turbo'
              },
              temperature: {
                type: 'number',
                title: 'Temperature',
                minimum: 0,
                maximum: 1,
                default: 0.7
              },
              systemPrompt: {
                type: 'string',
                title: 'System Prompt',
                format: 'textarea'
              }
            },
            required: ['model']
          }
        };
        
        const mockActionNode: NodeType = {
          id: 'instagram-reply',
          name: 'Instagram Reply',
          description: 'Sends a reply to an Instagram comment',
          category: NodeCategory.ACTION,
          version: '1.0.0',
          icon: 'reply',
          color: '#FF9800',
          ports: {
            inputs: [
              {
                id: 'comment',
                name: 'comment',
                label: 'Comment',
                description: 'The original comment data',
                dataType: NodeDataType.OBJECT,
                required: true
              },
              {
                id: 'replyText',
                name: 'replyText',
                label: 'Reply Text',
                description: 'The text to reply with',
                dataType: NodeDataType.STRING,
                required: true
              }
            ],
            outputs: [
              {
                id: 'result',
                name: 'result',
                label: 'Result',
                description: 'Result of the reply operation',
                dataType: NodeDataType.OBJECT,
                required: true
              }
            ]
          },
          settingsSchema: {
            type: 'object',
            properties: {
              accountId: {
                type: 'string',
                title: 'Instagram Account ID'
              },
              addHashtags: {
                type: 'boolean',
                title: 'Add Hashtags',
                default: false
              },
              delay: {
                type: 'number',
                title: 'Delay (seconds)',
                minimum: 0,
                default: 0
              }
            },
            required: ['accountId']
          }
        };
        
        // Create Chat Input trigger node
        const chatInputNode: NodeType = {
          id: 'chat-input',
          name: 'Chat Input',
          description: 'Manual text input trigger for chat conversations',
          category: NodeCategory.TRIGGER,
          version: '1.0.0',
          icon: 'message',
          color: '#4CAF50',
          ports: {
            inputs: [], // No inputs for trigger nodes
            outputs: [
              {
                id: 'message_data',
                name: 'message_data',
                label: 'Message Data',
                description: 'Structured message data with session info',
                dataType: NodeDataType.OBJECT,
                required: true
              }
            ]
          },
          settingsSchema: {
            type: 'object',
            properties: {} // No settings for this node
          }
        };
        
        setAvailableNodeTypes([mockTriggerNode, mockProcessorNode, mockActionNode, chatInputNode]);
      }
    } catch (err) {
      console.error('Failed to load node types:', err);
      // Use detailed mock types as fallback in case of error
      const triggerMock: NodeType = {
        id: 'trigger-mock',
        name: 'Trigger (Mock)',
        description: 'Mock trigger node for testing',
        category: NodeCategory.TRIGGER,
        version: '1.0.0',
        ports: {
          inputs: [],
          outputs: [
            {
              id: 'output1',
              name: 'output1',
              label: 'Output',
              description: 'Trigger output',
              dataType: NodeDataType.OBJECT,
              required: true
            }
          ]
        },
        settingsSchema: { type: 'object', properties: {} }
      };
      
      const processorMock: NodeType = {
        id: 'processor-mock',
        name: 'Processor (Mock)',
        description: 'Mock processor node for testing',
        category: NodeCategory.PROCESSOR,
        version: '1.0.0',
        ports: {
          inputs: [
            {
              id: 'input1',
              name: 'input1',
              label: 'Input',
              description: 'Processor input',
              dataType: NodeDataType.OBJECT,
              required: true
            }
          ],
          outputs: [
            {
              id: 'output1',
              name: 'output1',
              label: 'Output',
              description: 'Processor output',
              dataType: NodeDataType.OBJECT,
              required: true
            }
          ]
        },
        settingsSchema: { type: 'object', properties: {} }
      };
      
      const actionMock: NodeType = {
        id: 'action-mock',
        name: 'Action (Mock)',
        description: 'Mock action node for testing',
        category: NodeCategory.ACTION,
        version: '1.0.0',
        ports: {
          inputs: [
            {
              id: 'input1',
              name: 'input1',
              label: 'Input',
              description: 'Action input',
              dataType: NodeDataType.OBJECT,
              required: true
            }
          ],
          outputs: []
        },
        settingsSchema: { type: 'object', properties: {} }
      };
      
      setAvailableNodeTypes([triggerMock, processorMock, actionMock]);
    }
  };

  const handleSave = async (callback?: (error?: Error) => void) => {
    if (!flowId) {
      callback?.(new Error("No flow ID available to save."));
      return;
    }

    try {
      setSaving(true);
      // Get the current view state from React Flow
      const currentViewport = reactFlowInstance.getViewport();
      // Prepare node instances with current position & settings
      const nodeInstances = nodes.map((node) => {
        const nodeData = node.data as any;
        return {
          ...nodeData.instance,
          position: node.position,
        };
      });

      // Prepare connections derived from React Flow edges
      const connections = edges.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        sourcePortId: edge.sourceHandle as string,
        targetPortId: edge.targetHandle as string,
      }));

      // Persist full flow definition in one request
      await flowsAPI.saveFlowDefinition(parseInt(flowId), {
        nodes: nodeInstances,
        connections,
      });

      // Re-fetch graph so canvas reflects latest saved state
    const refreshedNodes = await flowsAPI.getFlowNodes(parseInt(flowId));
    const refreshedConns = await flowsAPI.getFlowConnections(parseInt(flowId));
    setNodes(refreshedNodes.map(mapNodeInstance));
    setEdges(refreshedConns.map(mapConnection).map(attachEdgeHandlers));
    
    // TODO: toast/snackbar for success
    callback?.(); // Signal success
    } catch (err: any) {
      console.error('Error saving flow:', err);
      callback?.(err); // Signal error
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleExecuteFlow = () => {
    console.log('🎯 Execute Flow button clicked!');
    console.log('📊 Current nodes:', nodes);
    console.log('📋 Available node types:', availableNodeTypes);
    
    // Find trigger node before opening dialog
    const triggerNode = nodes.find(node => {
      const nodeData = node.data as any;
      console.log('🔍 Checking node:', node.id, 'data:', nodeData);
      
      // Check if nodeType is attached
      if (nodeData?.nodeType) {
        console.log('📝 Node type found:', nodeData.nodeType.category);
        return nodeData.nodeType.category === NodeCategory.TRIGGER;
      }
      
      // Fallback: check by instance.typeId if nodeType not attached
      if (nodeData?.instance?.typeId) {
        const nodeType = availableNodeTypes.find(nt => nt.id === nodeData.instance.typeId);
        if (nodeType) {
          console.log('📝 Node type found via typeId:', nodeType.category);
          return nodeType.category === NodeCategory.TRIGGER;
        }
      }
      
      return false;
    });
    
    console.log('🎯 Found trigger node:', triggerNode);
    
    if (!triggerNode) {
      // Show error - no trigger node found
      console.error('❌ No trigger node found in flow');
      alert('No trigger node found in this flow. Please add a Chat Input node to execute the flow.');
      return;
    }
    
    console.log('✅ Opening execution dialog for trigger:', triggerNode.id);
    setTriggerNodeId(triggerNode.id);
    setExecutionDialogOpen(true);
  };

  // Sync frontend node states with backend execution results
  const syncNodeStatesWithExecutionResults = async (executionResults: Record<string, any>) => {
    console.log('🔄 Syncing node states with execution results:', executionResults);
    
    // Update nodes state with execution results
    setNodes((currentNodes) => 
      currentNodes.map((node) => {
        const nodeId = node.id;
        const executionResult = executionResults[nodeId];
        
        if (executionResult && executionResult.outputs) {
          console.log(`📝 Updating node ${nodeId} with outputs:`, executionResult.outputs);
          
          // Safely access and update node data
          const currentData = (node.data as any) || {};
          
          // Update the node's data with the execution outputs
          const updatedNode = {
            ...node,
            data: {
              ...currentData,
              // Store execution results in the node data
              executionResult: executionResult,
              // Update outputs for display in the node
              outputs: executionResult.outputs,
              // Update status and metadata
              status: executionResult.status,
              executionTime: executionResult.execution_time_ms,
              lastExecuted: executionResult.completed_at,
              // Ensure instance data is preserved
              instance: currentData.instance
            }
          };
          
          return updatedNode;
        }
        
        return node;
      })
    );
    
    console.log('✅ Frontend node states updated with execution results');
  };

  const handleFlowExecution = async (triggerInputs: Record<string, any>) => {
    if (!flowId) {
      throw new Error('No flow ID available');
    }
    
    try {
      console.log('🚀 Executing flow with inputs:', triggerInputs);
      const result = await nodeService.execution.executeFlow(
        parseInt(flowId),
        triggerInputs
      );
      
      console.log('✅ Flow execution completed:', result);
      
      // Update frontend node states with execution results
      await syncNodeStatesWithExecutionResults(result.execution_results);
      
      // Close dialog after successful execution
      setExecutionDialogOpen(false);
      
      // Optionally show success notification
      console.log('🔄 Node states synchronized with execution results');
      
    } catch (error) {
      console.error('❌ Flow execution failed:', error);
      throw error; // Re-throw to let dialog handle the error display
    }
  };

  // Handle edge deletion


  // Handle node deletion
  const onNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    // Close inspector if deleted node was selected
    if (selectedNode?.id === nodeId) {
      setInspectorOpen(false);
      setSelectedNode(null);
      setSelectedNodeType(null);
    }
  }, [setNodes, setEdges, selectedNode]);



  // Listen for custom auto-save events dispatched by node components
  useEffect(() => {
    const handleAutoSave = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log(`💾 Auto-saving flow due to: ${customEvent.detail.reason}`);
      handleSave(customEvent.detail.callback);
    };

    window.addEventListener('autoSaveFlow', handleAutoSave);
    return () => {
      window.removeEventListener('autoSaveFlow', handleAutoSave);
    };
  }, [handleSave]);

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const nodeData = node.data as any;
    if (nodeData?.nodeType && nodeData?.instance) {
      setSelectedNode(nodeData.instance);
      setSelectedNodeType(nodeData.nodeType);
      setInspectorOpen(true);
    }
  }, []);

  // Handle node updates from inspector and node execution results
  const handleNodeUpdate = useCallback((nodeId: string, updates: any) => {
    console.log('🔄 Updating node:', nodeId, updates);
    
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === nodeId) {
          // Type assertion for node.data to access its properties
          const nodeData = node.data as any;
          
          // Check if this is a lastExecution update from a node component
          if (updates.data?.lastExecution) {
            console.log('📊 Updating node execution results:', updates.data.lastExecution);
            
            // Create a new node with updated execution results
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
            
            // Only update selectedNode and open inspector if not already editing this node
            const isCurrentlyEditingThisNode = selectedNode?.id === nodeId && inspectorOpen;
            
            // Find the updated node from the nodes array
            const nodeInstance = (updatedNode.data as any).instance as NodeInstance;
            
            const updatedSelectedNode: NodeInstance = {
              ...nodeInstance,
              data: {
                ...nodeInstance.data,
                lastExecution: updates.data.lastExecution,
                ...(updates.data.inputs ? { inputs: updates.data.inputs } : {})
              }
            };
            
            if (!isCurrentlyEditingThisNode) {
              console.log('🔍 Updating selectedNode and opening inspector for execution results');
              
              // Update selectedNode and open inspector to show results
              setSelectedNode(updatedSelectedNode);
              setSelectedNodeType((updatedNode.data as any).instance.nodeType);
              setInspectorOpen(true);
              
              console.log('🔄 Updated selectedNode and opened inspector with execution results:', updatedSelectedNode);
            } else {
              console.log('🔒 Node is currently being edited, not overriding inspector state');
              // Still update the selectedNode data to reflect execution results, but don't change inspector state
              if (selectedNode?.id === nodeId) {
                setSelectedNode(updatedSelectedNode);
              }
            }
            
            return updatedNode;
          }
          
          // Regular update from inspector
          console.log('🔧 Processing regular update from inspector:', updates);
          
          // Handle settings updates properly
          if (updates.data?.settings) {
            console.log('⚙️ Updating node settings:', updates.data.settings);
            
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
            
            // Update selectedNode to maintain inspector state
            const updatedInstance = (updatedNode.data as any).instance as NodeInstance;
            setSelectedNode(updatedInstance);
            
            console.log('✅ Node updated with settings:', updatedInstance.data?.settings);
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
      });
      
      return updatedNodes;
    });
  }, [setNodes, selectedNode]);

  // Legacy handleChatInputExecution removed - now handled by individual node components

  // Handle drag over for drop zone
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop of nodes from sidebar
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const nodeTypeData = JSON.parse(event.dataTransfer.getData('application/json'));
      if (nodeTypeData.type === 'nodeType') {
        const newNode: Node = {
          id: `node_${Date.now()}`,
          type: 'customNode', // Use 'customNode' instead of category to match nodeTypes registration
          position,
          data: {
            nodeType: nodeTypeData.nodeType,
            instance: {
              id: `node_${Date.now()}`,
              typeId: nodeTypeData.nodeType.id,
              label: nodeTypeData.nodeType.name,
              position,
              data: {
                settings: {},
                inputs: {}
              },
              settings: {},
              inputs: {},
              disabled: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as NodeInstance,
            selected: false,
            executing: false,
            errors: [],
            onNodeDelete: onNodeDelete, // Pass the deletion handler
            onNodeUpdate: handleNodeUpdate // Pass the update handler for execution results
          }
        };

        setNodes((nds) => nds.concat(newNode));
      }
    },
    [reactFlowInstance, setNodes]
  );

  // Utility mapper for node instances - defined after all handlers
  const mapNodeInstance = useCallback((ni: NodeInstance): Node => {
    const nodeType = availableNodeTypes.find((t) => t.id === ni.typeId);
    return {
      id: ni.id,
      type: 'customNode',
      position: ni.position,
      data: { 
        instance: ni, 
        nodeType,
        onNodeDelete: onNodeDelete,
        onNodeUpdate: handleNodeUpdate
      },
    } as Node;
  }, [availableNodeTypes, onNodeDelete, handleNodeUpdate]);

  // Category colors for node types
  const getCategoryColor = (category: NodeCategory) => {
    switch (category) {
      case NodeCategory.TRIGGER:
        return '#4CAF50';
      case NodeCategory.PROCESSOR:
        return '#2196F3';
      case NodeCategory.ACTION:
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  // Group node types by category and subcategory for sidebar rendering
  const groupedNodeTypes = useMemo(() => {
    const groups: Record<NodeCategory, Record<string, NodeType[]>> = {
      [NodeCategory.TRIGGER]: {},
      [NodeCategory.PROCESSOR]: {},
      [NodeCategory.ACTION]: {}
    };

    availableNodeTypes.forEach(nt => {
      const sub = nt.subcategory || 'General';
      if (!groups[nt.category][sub]) {
        groups[nt.category][sub] = [];
      }
      groups[nt.category][sub].push(nt);
    });

    return groups;
  }, [availableNodeTypes]);

  // Draggable node item in sidebar
  const DraggableNodeItem: React.FC<{ nodeType: NodeType }> = ({ nodeType }) => {
    const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
      event.dataTransfer.setData('application/reactflow', nodeType.category);
      event.dataTransfer.setData('application/json', JSON.stringify({
        type: 'nodeType',
        nodeType: nodeType
      }));
      event.dataTransfer.effectAllowed = 'move';
    };

    return (
      <Paper
        sx={{
          p: 2,
          mb: 1,
          cursor: 'grab',
          border: `2px solid ${getCategoryColor(nodeType.category)}40`,
          '&:hover': {
            border: `2px solid ${getCategoryColor(nodeType.category)}80`,
            transform: 'translateY(-1px)',
          },
          '&:active': {
            cursor: 'grabbing'
          }
        }}
        draggable
        onDragStart={(e) => onDragStart(e, nodeType)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Chip
            label={nodeType.category}
            size="small"
            sx={{
              backgroundColor: getCategoryColor(nodeType.category),
              color: 'white',
              mr: 1
            }}
          />
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
          {nodeType.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {nodeType.description}
        </Typography>
      </Paper>
    );
  };

  const handleNameSave = async () => {
    if (!flowId) return;

    try {
      setNameSaving(true);
      await flowsAPI.updateFlow(parseInt(flowId), { name: flowName });
      console.log('✅ Flow name updated:', flowName);
    } catch (err: any) {
      console.error('Error updating flow name:', err);
    } finally {
      setNameSaving(false);
      setIsEditingName(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Loading flow builder...</Typography>
      </Container>
    );
  }

  // Remove the error blocking render - let the UI show even with errors
  // if (error) {
  //   return (
  //     <Container maxWidth="lg" sx={{ py: 4 }}>
  //       <Alert severity="error" action={
  //         <Button color="inherit" size="small" onClick={loadFlow}>
  //           Retry
  //         </Button>
  //       }>
  //         {error}
  //       </Alert>
  //     </Container>
  //   );
  // }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Flow Builder Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Tooltip title="Back to Dashboard">
            <IconButton edge="start" onClick={handleBack}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          {isEditingName ? (
            <TextField
              size="small"
              value={flowName}
              autoFocus
              onChange={(e) => setFlowName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNameSave();
                } else if (e.key === 'Escape') {
                  setIsEditingName(false);
                  setFlowName(flow?.name || '');
                }
              }}
              sx={{ flexGrow: 1, ml: 2, maxWidth: 300 }}
              disabled={nameSaving}
            />
          ) : (
            <Typography
              variant="h6"
              sx={{ flexGrow: 1, ml: 2, cursor: 'pointer' }}
              onClick={() => setIsEditingName(true)}
            >
              {flowName || 'Flow Builder'}
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Flow Settings">
              <IconButton>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Execute Flow">
              <IconButton color="primary" onClick={handleExecuteFlow}>
                <PlayIcon />
              </IconButton>
            </Tooltip>
            
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Flow Builder Area */}
      <Box sx={{ flexGrow: 1, display: 'flex' }}>
        {/* Node Library Sidebar */}
        <Paper 
          sx={{ 
            width: 300, 
            borderRadius: 0, 
            borderRight: 1, 
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Node Library</Typography>
            <Typography variant="body2" color="text.secondary">
              Drag nodes to the canvas to build your flow
            </Typography>
          </Box>
          
          <Box sx={{ flexGrow: 1, p: 2, overflow: 'auto' }}>
            {([NodeCategory.TRIGGER, NodeCategory.PROCESSOR, NodeCategory.ACTION] as NodeCategory[]).map(category => {
              const subGroups = groupedNodeTypes[category];
              const hasNodes = Object.keys(subGroups).length > 0;
              if (!hasNodes) return null;
              return (
                <Box key={category} sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                    {category.charAt(0) + category.slice(1).toLowerCase()} Nodes
                  </Typography>
                  {Object.entries(subGroups).map(([subName, types]) => (
                    <Accordion key={subName} disableGutters sx={{ mb: 1 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                          {subName} ({types.length})
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 1 }}>
                        {types.map(nt => (
                          <DraggableNodeItem key={nt.id} nodeType={nt} />
                        ))}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              );
            })}
          </Box>
        </Paper>

        {/* React Flow Canvas */}
        <Box sx={{ flexGrow: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={validatedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={null}
            fitView
            attributionPosition="bottom-left"
            isValidConnection={isValidConnection}
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </Box>

        {/* Node Inspector */}
        <NodeInspector
          selectedNode={selectedNode}
          nodeType={selectedNodeType}
          open={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          onNodeUpdate={handleNodeUpdate}
        />
      </Box>
      
      {/* Flow Execution Dialog */}
      <FlowExecutionDialog
        open={executionDialogOpen}
        onClose={() => setExecutionDialogOpen(false)}
        flowName={flow?.name || 'Untitled Flow'}
        triggerNodeId={triggerNodeId}
        onExecute={handleFlowExecution}
      />
    </Box>
  );
};

// Main FlowBuilder component wrapped with ReactFlowProvider
const FlowBuilder: React.FC = () => {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner />
    </ReactFlowProvider>
  );
};

export default FlowBuilder;
