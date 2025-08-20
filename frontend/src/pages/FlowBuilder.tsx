import React, { useEffect, useCallback, useMemo } from 'react';
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
  TextField
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  applyEdgeChanges,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useReactFlow,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { NodeType, NodeCategory, NodeInstance, NodeConnection, NodeDataType } from '../types/nodes';
import { flowsAPI } from '../services/api';
import { nodeService } from '../services/nodeService';
import { NodeComponentFactory } from '../components/nodes/core/NodeComponentFactory';
import { edgeTypes } from '../components/edges/CustomEdge';
import { NodeInspector } from '../components/inspector';
import { ChatBotExecutionDialog } from '../components/dialogs/ChatBotExecutionDialog';
import { FlowExecutionDialog } from '../components/dialogs/FlowExecutionDialog';
import { loadNodeConfigurations } from '../config/nodeConfiguration';
import { useConnectionValidation } from '../hooks/useConnectionValidation';
import { useSnackbar } from '../components/SnackbarProvider';
import { ModernNodeLibrary } from '../components/NodeLibrary';
import { useFlowBuilderStore } from '../store/flowBuilderStore';
import '../styles/connectionValidation.css';
import '../styles/flowBuilder.css';
import '../styles/nodeHandles.css';

// Define nodeTypes using our NodeComponentFactory for all node types
const nodeTypes = {
  customNode: NodeComponentFactory
};

// Inner FlowBuilder component that uses React Flow hooks
const FlowBuilderInner: React.FC = () => {
  const { showSnackbar } = useSnackbar();
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  
  // Use centralized store
  const {
    // Flow state
    flow, flowName, isEditingName, nameSaving, loading, saving,
    // Node state
    nodes, edges, availableNodeTypes,
    // Inspector state
    selectedNode, selectedNodeType, inspectorOpen,
    // Execution state
    executionDialogOpen, triggerNodeId, triggerNodeType,
    // Actions
    setFlow, setFlowName, setIsEditingName, setNameSaving, setLoading, setSaving,
    setNodes, setEdges, setAvailableNodeTypes,
    setSelectedNode, setSelectedNodeType, setInspectorOpen,
    setExecutionDialogOpen, setTriggerNodeId, setTriggerNodeType,
    updateNode, deleteNode, syncExecutionResults
  } = useFlowBuilderStore();

  // React Flow change handlers
  const onNodesChange = useCallback((changes: any) => {
    setNodes((nds) => {
      const updatedNodes = [...nds];
      changes.forEach((change: any) => {
        const nodeIndex = updatedNodes.findIndex(n => n.id === change.id);
        if (nodeIndex >= 0) {
          if (change.type === 'position' && change.position) {
            updatedNodes[nodeIndex] = {
              ...updatedNodes[nodeIndex],
              position: change.position
            };
          } else if (change.type === 'remove') {
            updatedNodes.splice(nodeIndex, 1);
          }
        }
      });
      return updatedNodes;
    });
  }, [setNodes]);

  const onEdgesChange = useCallback((changes: any) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [setEdges]);

  // When node types are loaded, ensure all existing nodes have their nodeType attached
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
  }, [availableNodeTypes, flowId, nodes.length, loading, setNodes, setEdges]);
  
  // First declare the mapConnection without the onEdgeDelete handler
  const mapConnection = useCallback((c: NodeConnection): Edge => ({
    id: c.id,
    source: c.sourceNodeId,
    target: c.targetNodeId,
    sourceHandle: c.sourcePortId,
    targetHandle: c.targetPortId,
    type: 'custom',
  }), []);

  
  // Define onEdgeDelete
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
    getValidatedEdges
  } = useConnectionValidation(nodes, nodeTypesMap, {
    realTimeValidation: false,
    preventInvalidConnections: false
  });
  
  // Handle new connections with simplified validation
  const onConnect = useCallback((connection: Connection) => {
    console.log('🔗 Attempting to create connection:', connection);
    
    // Basic validation: prevent self-connections and duplicate connections
    if (connection.source === connection.target) {
      console.warn('❌ Cannot connect node to itself');
      showSnackbar({
        message: 'Cannot connect a node to itself',
        severity: 'warning',
      });
      return;
    }
    
    // Check for existing connection between same nodes and handles
    const existingConnection = edges.find(edge => 
      edge.source === connection.source && 
      edge.target === connection.target &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.targetHandle === connection.targetHandle
    );
    
    if (existingConnection) {
      console.warn('❌ Connection already exists');
      showSnackbar({
        message: 'Connection already exists between these ports',
        severity: 'warning',
      });
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
    
    showSnackbar({
      message: 'Nodes connected successfully',
      severity: 'success',
    });
  }, [edges, setEdges, attachEdgeHandlers, showSnackbar]);
  
  // Apply validation styling to edges
  const validatedEdges = useMemo(() => {
    return getValidatedEdges(edges);
  }, [getValidatedEdges, edges]);
  

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
      const backendNodeTypes = await nodeService.types.getNodeTypes(); 
      
      if (backendNodeTypes && backendNodeTypes.length > 0) {
        console.log('✅ Loading backend node types:', backendNodeTypes.map(t => t.name));
        
        // Load dynamic node configurations from backend data
        await loadNodeConfigurations(backendNodeTypes);
        
        // Set available node types for legacy compatibility
        setAvailableNodeTypes(backendNodeTypes);
        
        console.log('✅ Dynamic node configurations loaded successfully');
        return;
      } else {
        console.warn('⚠️ No node types returned from backend, using empty configuration');
        setAvailableNodeTypes([]);
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

  const handleSave = async () => {
    if (!flowId) {
      const error = new Error("No flow ID available to save.");
      showSnackbar({
        message: `Failed to save flow: ${error.message}`,
        severity: 'error',
      });
      return;
    }

    try {
      setSaving(true);
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
      
      showSnackbar({
        message: 'Flow saved successfully',
        severity: 'success',
      });
    } catch (err: any) {
      console.error('Error saving flow:', err);
      showSnackbar({
        message: `Failed to save flow: ${err?.message || 'Unknown error'}`,
        severity: 'error',
      });
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
    
    // Find trigger node(s) before opening dialog
    const triggerNodes = nodes.filter(node => {
      const nodeData = node.data as any;
      console.log('🔍 Checking node:', node.id, 'data:', nodeData);
      
      // Prefer attached nodeType
      if (nodeData?.nodeType) {
        const isTrigger = nodeData.nodeType.category === NodeCategory.TRIGGER;
        if (isTrigger) console.log('📝 Node type found (attached): TRIGGER');
        return isTrigger;
      }
      
      // Fallback: resolve via instance.typeId
      if (nodeData?.instance?.typeId) {
        const nodeType = availableNodeTypes.find(nt => nt.id === nodeData.instance.typeId);
        const isTrigger = !!nodeType && nodeType.category === NodeCategory.TRIGGER;
        if (isTrigger) console.log('📝 Node type found via typeId: TRIGGER');
        return isTrigger;
      }
      
      return false;
    });
    
    console.log('🎯 Found trigger nodes:', triggerNodes.map(n => n.id));
    
    if (triggerNodes.length === 0) {
      // Show error - no trigger node found
      console.error('❌ No trigger node found in flow');
      showSnackbar({
        message: 'No trigger node found. Please add exactly one trigger node (e.g., Chat Input) to execute the flow.',
        severity: 'error',
      });
      return;
    }

    if (triggerNodes.length > 1) {
      // Show error - more than one trigger node found
      console.error(`❌ Multiple trigger nodes found in flow: ${triggerNodes.map(n => n.id).join(', ')}`);
      showSnackbar({
        message: `Multiple trigger nodes found (${triggerNodes.length}). Only one trigger node is allowed. Keep exactly one trigger node.`,
        severity: 'error',
      });
      return;
    }

    const triggerNode = triggerNodes[0];
    console.log('🎯 Selected trigger node:', triggerNode);
    
    // Get trigger node type
    const nodeData = triggerNode.data as any;
    let nodeTypeId = null;
    
    if (nodeData?.nodeType) {
      nodeTypeId = nodeData.nodeType.id;
    } else if (nodeData?.instance?.typeId) {
      nodeTypeId = nodeData.instance.typeId;
    }
    
    console.log('✅ Opening execution dialog for trigger:', triggerNode.id, 'type:', nodeTypeId);
    setTriggerNodeId(triggerNode.id);
    setTriggerNodeType(nodeTypeId);
    setExecutionDialogOpen(true);
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
      syncExecutionResults(result.execution_results);
      
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
    deleteNode(nodeId);
  }, [deleteNode]);



  // Listen for custom auto-save events dispatched by node components
  useEffect(() => {
    const handleAutoSave = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log(`💾 Auto-saving flow due to: ${customEvent.detail.reason}`);
      handleSave().then(() => {
        customEvent.detail.callback?.();
      }).catch((error) => {
        customEvent.detail.callback?.(error);
      });
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
    updateNode(nodeId, updates);
  }, [updateNode]);

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
            onNodeUpdate: handleNodeUpdate,// Pass the update handler for execution results
            flowId: flowId,
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
        onNodeUpdate: handleNodeUpdate,
        flowId: flowId,
      },
    } as Node;
  }, [availableNodeTypes, onNodeDelete, handleNodeUpdate, flowId]);



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
        <Toolbar sx={{ minHeight: '64px' }}>
          <Tooltip title="Back to Dashboard">
            <IconButton edge="start" onClick={handleBack} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          {isEditingName ? (
            <TextField
              size="small"
              value={flowName}
              autoFocus
              variant="outlined"
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
              sx={{ 
                flexGrow: 1, 
                ml: 2, 
                maxWidth: 300,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '6px',
                }
              }}
              disabled={nameSaving}
            />
          ) : (
            <Typography
              variant="h6"
              sx={{ 
                flexGrow: 1, 
                ml: 2, 
                cursor: 'pointer',
                fontWeight: 500,
                '&:hover': {
                  color: 'primary.main'
                }
              }}
              onClick={() => setIsEditingName(true)}
            >
              {flowName || 'Flow Builder'}
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Tooltip title="Flow Settings">
              <IconButton sx={{ color: 'text.secondary' }}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Execute Flow">
              <IconButton 
                color="primary" 
                onClick={handleExecuteFlow}
                sx={{ 
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.15)'
                  }
                }}
              >
                <PlayIcon />
              </IconButton>
            </Tooltip>
            
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => handleSave()}
              disabled={saving}
              sx={{ 
                borderRadius: '6px',
                textTransform: 'none',
                fontWeight: 500,
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Flow Builder Area */}
      <Box sx={{ flexGrow: 1, display: 'flex' }}>
        {/* Modern Node Library Sidebar */}
        <Paper 
          sx={{ 
            width: 320, 
            borderRadius: 0, 
            borderRight: 1, 
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#fafafa',
            boxShadow: 'none',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 2
          }}
          elevation={0}
        >
          <ModernNodeLibrary onNodeDragStart={(event, nodeType) => {
            event.dataTransfer.setData('application/reactflow', nodeType.category);
            event.dataTransfer.setData('application/json', JSON.stringify({
              type: 'nodeType',
              nodeType: nodeType
            }));
            event.dataTransfer.effectAllowed = 'move';
          }} />
        </Paper>

        {/* React Flow Canvas */}
        <Box sx={{ 
          flexGrow: 1, 
          position: 'relative',
          borderLeft: '1px solid rgba(0, 0, 0, 0.08)'
        }}>
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
            isValidConnection={() => true}
          >
            <Controls 
              position="bottom-right" 
              showInteractive={false} 
              style={{ 
                background: 'rgba(255, 255, 255, 0.8)', 
                borderRadius: '8px',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                padding: '4px'
              }}
              className="custom-flow-controls"
            />
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
      
      {/* Flow Execution Dialogs (conditional) */}
      {executionDialogOpen && (triggerNodeType === 'chat_input' || triggerNodeType === 'voice_input') ? (
        <ChatBotExecutionDialog
          open={executionDialogOpen}
          onClose={() => setExecutionDialogOpen(false)}
          flowName={flow?.name || 'Untitled Flow'}
          triggerNodeId={triggerNodeId}
          triggerNodeType={triggerNodeType}
          onExecute={handleFlowExecution}
        />
      ) : (
        <FlowExecutionDialog
          open={executionDialogOpen}
          onClose={() => setExecutionDialogOpen(false)}
          flowName={flow?.name || 'Untitled Flow'}
          triggerNodeId={triggerNodeId}
          triggerNodeType={triggerNodeType}
          onExecute={handleFlowExecution}
        />
      )}
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
