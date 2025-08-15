// Enhanced NodeComponentFactory with smart routing and configuration injection
import React, { useMemo } from 'react';
import { NodeProps } from '@xyflow/react';
import { getNodeComponent, DefaultNode } from '../registry';
import { getSafeNodeConfiguration, isConfigurationReady } from '../../../config/nodeConfiguration';
import { BaseNode } from './BaseNode';
import { FlowNode } from '../../../types/nodes';
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
  const nodeData = data as FlowNode['data'];
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
    return <DefaultNode {...props} />;
  }
  
  if (!nodeTypeId) {
    console.warn(`NodeComponentFactory[${id}]: Missing nodeTypeId`, nodeData);
    return <DefaultNode {...props} />;
  }
  
  // Handle configuration loading states
  if (!isConfigurationReady() || configLoading) {
    return (
      <BaseNode 
        {...props}
        nodeConfig={{
          id: nodeTypeId,
          name: 'Loading...',
          description: 'Node configuration loading',
          category: nodeData.nodeType?.category || 'processor' as any,
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
        }}
      />
    );
  }
  
  if (configError) {
    console.error(`NodeComponentFactory[${id}]: Configuration error for ${nodeTypeId}:`, configError);
    return <DefaultNode {...props} />;
  }
  
  // Smart routing based on determined strategy
  switch (renderingStrategy) {
    case RenderingStrategy.CUSTOM_COMPONENT: {
      const CustomNodeComponent = getNodeComponent(nodeTypeId);
      console.log(`NodeComponentFactory[${id}]: Rendering custom component for ${nodeTypeId}`);
      
      // Inject configuration into custom component props
      const enhancedProps = {
        ...props,
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
      console.log(`NodeComponentFactory[${id}]: Rendering BaseNode with config for ${nodeTypeId}`);
      
      return (
        <BaseNode
          {...props}
          nodeConfig={nodeConfig}
        />
      );
    }
    
    case RenderingStrategy.FALLBACK_DEFAULT:
    default: {
      console.warn(`NodeComponentFactory[${id}]: Falling back to DefaultNode for ${nodeTypeId}`);
      return <DefaultNode {...props} />;
    }
  }
};