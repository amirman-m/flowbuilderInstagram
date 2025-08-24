// Enhanced NodeComponentFactory with smart routing and configuration injection
import React, { useMemo } from 'react';
import { NodeProps } from '@xyflow/react';
import { getNodeComponent, DefaultNode, NodeData, NodeComponentProps } from '../registry';
import { getSafeNodeConfiguration, isConfigurationReady } from '../../../config/nodeConfiguration';
import { BaseNode } from './BaseNode';
import { FlowNode, NodeCategory, NodeType, NodeInstance } from '../../../types/nodes';
import { useNodeConfiguration } from '../hooks/useNodeConfiguration';

/**
 * Smart routing strategies for node rendering
 */
enum RenderingStrategy {
  CUSTOM_COMPONENT = 'custom_component',
  BASE_NODE_WITH_CONFIG = 'base_node_with_config',
  FALLBACK_DEFAULT = 'fallback_default'
}

/**
 * Enhanced NodeComponentFactory with smart routing and configuration injection
 * 
 * Features:
 * - Smart routing based on node configuration and available components
 * - Automatic configuration injection
 * - Performance optimization with memoization
 * - Comprehensive error handling and fallbacks
 */
export const NodeComponentFactory: React.FC<NodeProps> = (props) => {
  const { data, id } = props;
  
  // Extract node type information
  const nodeData = data as unknown as FlowNode['data'];
  const nodeTypeId = nodeData?.nodeType?.id;
  
  // Get node configuration using the hook system
  const { 
    config: nodeConfig, 
    isLoading: configLoading, 
    error: configError 
  } = useNodeConfiguration(nodeTypeId);
  
  // Determine rendering strategy based on available components and configuration
  const renderingStrategy = useMemo((): RenderingStrategy => {
    if (!nodeTypeId || !nodeConfig) {
      return RenderingStrategy.FALLBACK_DEFAULT;
    }
    
    // Check if custom component exists and is different from default
    const CustomComponent = getNodeComponent(nodeTypeId);
    if (CustomComponent && CustomComponent !== DefaultNode) {
      return RenderingStrategy.CUSTOM_COMPONENT;
    }
    
    // Use BaseNode with dynamic configuration
    if (nodeConfig.features?.hasCustomUI || nodeConfig.componentName !== 'DefaultNode') {
      return RenderingStrategy.BASE_NODE_WITH_CONFIG;
    }
    
    return RenderingStrategy.FALLBACK_DEFAULT;
  }, [nodeTypeId, nodeConfig]);
  
  // Enhanced error handling
  if (!data || !nodeData) {
    console.warn(`NodeComponentFactory[${id}]: Invalid node data`, data);
    return <DefaultNode data={createDefaultNodeData()} selected={false} id={id} />;
  }
  
  if (!nodeTypeId) {
    console.warn(`NodeComponentFactory[${id}]: Missing nodeTypeId`, nodeData);
    return <DefaultNode data={createDefaultNodeData()} selected={false} id={id} />;
  }
  
  // Handle configuration loading states
  if (!isConfigurationReady() || configLoading) {
    const loadingNodeConfig = {
      id: nodeTypeId,
      name: 'Loading...',
      description: 'Node configuration loading',
      category: nodeData.nodeType?.category || NodeCategory.PROCESSOR,
      subcategory: 'System',
      componentName: 'LoadingNode',
      icon: () => null,
      color: '#9CA3AF',
      features: {
        hasSettings: false,
        hasExecution: false,
        hasCustomUI: false,
        hasStatusIndicator: false
      },
      ports: { maxInputs: 0, maxOutputs: 0, requiredInputs: [], requiredOutputs: [] }
    };
    
    return (
      <BaseNode 
        data={createNodeData(nodeData)}
        selected={props.selected || false}
        id={id}
        nodeConfig={loadingNodeConfig}
      />
    );
  }
  
  if (configError) {
    console.error(`NodeComponentFactory[${id}]: Configuration error for ${nodeTypeId}:`, configError);
    return <DefaultNode data={createNodeData(nodeData)} selected={props.selected || false} id={id} />;
  }
  
  // Smart routing based on determined strategy
  switch (renderingStrategy) {
    case RenderingStrategy.CUSTOM_COMPONENT: {
      const CustomNodeComponent = getNodeComponent(nodeTypeId);
      
      // Inject configuration into custom component props
      const nodeComponentProps: NodeComponentProps = {
        data: createNodeData(nodeData),
        selected: props.selected || false,
        id: id
      };
      
      const enhancedProps = {
        ...nodeComponentProps,
        nodeConfig,
        // Additional context for custom components
        renderingContext: {
          strategy: renderingStrategy,
          hasConfiguration: true,
          configurationSource: 'dynamic'
        }
      };
      
      return <CustomNodeComponent {...enhancedProps} />;
    }
    
    case RenderingStrategy.BASE_NODE_WITH_CONFIG: {
      
      return (
        <BaseNode
          data={createNodeData(nodeData)}
          selected={props.selected || false}
          id={id}
          nodeConfig={nodeConfig}
        />
      );
    }
    
    case RenderingStrategy.FALLBACK_DEFAULT:
    default: {
      
      return <DefaultNode data={createNodeData(nodeData)} selected={props.selected || false} id={id} />;
    }
  }
};

// Helper function to create properly typed NodeData from flow data
function createNodeData(flowData: any): NodeData {
  return {
    nodeType: flowData?.nodeType || createDefaultNodeType('unknown'),
    instance: flowData?.instance || createDefaultNodeInstance(),
    flowId: flowData?.flowId,
    selected: flowData?.selected,
    executing: flowData?.executing,
    errors: flowData?.errors,
    executionResult: flowData?.executionResult,
    onNodeDelete: flowData?.onNodeDelete,
    onNodeUpdate: flowData?.onNodeUpdate,
    onExecute: flowData?.onExecute,
    onExecutionComplete: flowData?.onExecutionComplete
  };
}

// Create default node data for error states
function createDefaultNodeData(): NodeData {
  return {
    nodeType: createDefaultNodeType('unknown'),
    instance: createDefaultNodeInstance()
  };
}

// Create a default node type for error states
function createDefaultNodeType(id: string): NodeType {
  return {
    id: id,
    name: 'Unknown Node',
    description: 'Node type information unavailable',
    category: NodeCategory.PROCESSOR,
    version: '0.0.0',
    ports: { inputs: [], outputs: [] },
    settingsSchema: { type: 'object', properties: {} }
  };
}

// Create a default node instance for error states
function createDefaultNodeInstance(): NodeInstance {
  return {
    id: 'unknown',
    type: 'unknown',
    position: { x: 0, y: 0 },
    data: {
      settings: {},
      inputs: {}
    }
  };
}
