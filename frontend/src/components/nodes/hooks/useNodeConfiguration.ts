// Hook for accessing node configuration data
import { useMemo } from 'react';
import { NodeConfiguration, getNodeConfiguration, getNodeIcon } from '../../../config/nodeConfiguration';
import { getCategoryColor } from '../../../styles/nodeTheme';
import { NodeCategory } from '../../../types/nodes';
import { NodeDataWithHandlers } from '../registry';

/**
 * Enhanced hook return type with loading and error states
 */
export interface UseNodeConfigurationReturn {
  config: NodeConfiguration;
  isLoading: boolean;
  error: Error | null;
  isValid: boolean;
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: NodeCategory;
  subcategory: string;
  componentName: string;
  icon: any;
  color: string;
  features: any;
  ports: any;
  customStyles?: any;
  categoryColor: string;
  hasSettings: boolean;
  hasExecution: boolean;
  hasCustomUI: boolean;
  hasStatusIndicator: boolean;
  validatePorts: () => any;
}

/**
 * Custom React hook to access node configuration data in a type-safe way.
 * 
 * This hook provides easy access to node metadata, styling information,
 * and feature flags from the centralized configuration system.
 * 
 * @param nodeTypeId - The node type identifier
 * @param nodeData - Optional node data for additional context
 * @returns Object containing configuration data and utility functions
 */
export const useNodeConfiguration = (
  nodeTypeId?: string,
  nodeData?: NodeDataWithHandlers
): UseNodeConfigurationReturn => {
  return useMemo(() => {
    // Handle missing nodeTypeId
    if (!nodeTypeId) {
      return {
        config: {} as NodeConfiguration,
        isLoading: false,
        error: new Error('Missing nodeTypeId'),
        isValid: false,
        id: '',
        name: 'Invalid Node',
        displayName: 'Invalid Node',
        description: 'Node type ID is missing',
        category: NodeCategory.PROCESSOR,
        subcategory: 'Error',
        componentName: 'DefaultNode',
        icon: () => null,
        color: '#EF4444',
        features: {},
        ports: {},
        categoryColor: '#EF4444',
        hasSettings: false,
        hasExecution: false,
        hasCustomUI: false,
        hasStatusIndicator: false,
        validatePorts: () => ({ isValid: false, errors: ['Missing nodeTypeId'] })
      };
    }

    // Get configuration from centralized system
    const config = getNodeConfiguration(nodeTypeId);
    
    // Fallback configuration for unknown node types
    const fallbackConfig: NodeConfiguration = {
      id: nodeTypeId,
      category: NodeCategory.PROCESSOR,
      subcategory: 'Unknown',
      name: 'Unknown Node',
      description: 'Unknown node type',
      icon: getNodeIcon('default'),
      color: '#757575',
      componentName: 'UnknownNode',
      features: {
        hasSettings: false,
        hasExecution: false,
        hasCustomUI: false,
        hasStatusIndicator: false
      }
    };
    
    const safeConfig = config || fallbackConfig;
    
    // Extract additional data from node instance if available
    const instance = nodeData?.instance;
    const nodeType = nodeData?.nodeType;
    
    // Get display name (prefer instance label over config name)
    const displayName = instance?.label || safeConfig.name;
    
    // Get category color
    const categoryColor = getCategoryColor(safeConfig.category);
    
    // Get icon component
    const IconComponent = safeConfig.icon;
    
    // Feature flags for conditional rendering
    const features = {
      ...safeConfig.features,
      // Override with runtime checks if needed
      hasSettings: safeConfig.features.hasSettings && Boolean(nodeType?.settingsSchema),
      hasExecution: safeConfig.features.hasExecution,
      hasCustomUI: safeConfig.features.hasCustomUI,
      hasStatusIndicator: safeConfig.features.hasStatusIndicator
    };
    
    // Port information
    const ports = {
      inputs: nodeType?.ports?.inputs || [],
      outputs: nodeType?.ports?.outputs || [],
      maxInputs: safeConfig.ports?.maxInputs,
      maxOutputs: safeConfig.ports?.maxOutputs,
      requiredInputs: safeConfig.ports?.requiredInputs || [],
      requiredOutputs: safeConfig.ports?.requiredOutputs || []
    };
    
    return {
      // Core configuration
      config: safeConfig,
      isValid: Boolean(config),
      
      // Display properties
      id: safeConfig.id,
      name: safeConfig.name,
      displayName,
      description: safeConfig.description,
      category: safeConfig.category,
      subcategory: safeConfig.subcategory,
      
      // Visual properties
      color: categoryColor,
      icon: IconComponent,
      
      // Feature flags
      features,
      
      // Port information
      ports,
      
      // Utility functions
      hasFeature: (feature: keyof typeof features) => features[feature],
      isCategory: (category: NodeCategory) => safeConfig.category === category,
      isTrigger: () => safeConfig.category === NodeCategory.TRIGGER,
      isProcessor: () => safeConfig.category === NodeCategory.PROCESSOR,
      isAction: () => safeConfig.category === NodeCategory.ACTION,
      
      // Style helpers
      getCategoryColor: () => categoryColor,
      getVariantColor: (opacity: number = 1) => `${categoryColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
      
      // Validation helpers
      validatePorts: () => {
        const inputCount = ports.inputs.length;
        const outputCount = ports.outputs.length;
        
        return {
          isValid: true,
          inputsValid: !ports.maxInputs || inputCount <= ports.maxInputs,
          outputsValid: !ports.maxOutputs || outputCount <= ports.maxOutputs,
          hasRequiredInputs: ports.requiredInputs.every(portId => 
            ports.inputs.some(port => port.id === portId)
          ),
          hasRequiredOutputs: ports.requiredOutputs.every(portId => 
            ports.outputs.some(port => port.id === portId)
          )
        };
      }
    };
  }, [nodeTypeId, nodeData]);
};

export default useNodeConfiguration;
