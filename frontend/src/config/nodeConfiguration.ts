// Unified node configuration system - Single source of truth for all node metadata
import { NodeCategory } from '../types/nodes';
import { NODE_ICONS, NodeIconComponent } from './nodeIcons';

// Enhanced configuration interface
export interface NodeConfiguration {
  id: string;
  category: NodeCategory;
  subcategory: string;
  name: string;
  description: string;
  icon: NodeIconComponent;
  color: string;
  componentName: string;
  customStyles?: Partial<NodeStyles>;
  features: {
    hasSettings: boolean;
    hasExecution: boolean;
    hasCustomUI: boolean;
    hasStatusIndicator: boolean;
  };
  ports?: {
    maxInputs?: number;
    maxOutputs?: number;
    requiredInputs?: string[];
    requiredOutputs?: string[];
  };
}

// Style configuration interface
export interface NodeStyles {
  minWidth: number;
  minHeight: number;
  padding: number;
  borderRadius: number;
  borderWidth: number;
  fontSize: string;
  fontWeight: string | number;
}

// Category color mapping (centralized from categories.ts)
export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  [NodeCategory.TRIGGER]: '#10b981',    // Green
  [NodeCategory.PROCESSOR]: '#3b82f6',  // Blue  
  [NodeCategory.ACTION]: '#f59e0b',     // Orange
  [NodeCategory.MY_MODEL]: '#8b5cf6',   // Purple
};

// Import the single source of truth for frontend node metadata
import { NODE_REGISTRY } from './nodeRegistry';

// Dynamic configuration cache
let NODE_CONFIGURATIONS: Record<string, NodeConfiguration> = {};
let isConfigurationLoaded = false;

/**
 * Build configuration from backend NodeType data + frontend overrides
 */
const buildNodeConfiguration = (backendNodeType: any): NodeConfiguration => {
  const nodeTypeId = backendNodeType.id;
  const registryEntry = NODE_REGISTRY[nodeTypeId];
  
  // Get icon from nodeIcons.ts or fallback to default
  const icon = NODE_ICONS[nodeTypeId] || NODE_ICONS['default'];
  
  // Get color from backend or fallback to category color
  const color = backendNodeType.color || CATEGORY_COLORS[backendNodeType.category as NodeCategory] || '#757575';
  
  // Build ports configuration from backend data
  const ports = {
    maxInputs: backendNodeType.ports?.inputs?.length || 0,
    maxOutputs: backendNodeType.ports?.outputs?.length || 0,
    requiredInputs: backendNodeType.ports?.inputs?.filter((p: any) => p.required).map((p: any) => p.id) || [],
    requiredOutputs: backendNodeType.ports?.outputs?.filter((p: any) => p.required).map((p: any) => p.id) || []
  };
  
  return {
    // Core data from backend (single source of truth)
    id: backendNodeType.id,
    name: backendNodeType.name,
    description: backendNodeType.description,
    category: backendNodeType.category,
    color,
    icon,
    ports,
    
    // Frontend-specific data from NODE_REGISTRY (single source of truth)
    subcategory: registryEntry?.subcategory || 'General',
    componentName: registryEntry?.componentName || 'DefaultNode',
    features: {
      // Default features based on backend schema
      hasSettings: Boolean(backendNodeType.settings_schema?.properties && Object.keys(backendNodeType.settings_schema.properties).length > 0),
      hasExecution: true, // Most nodes can be executed
      hasCustomUI: false,
      hasStatusIndicator: true,
      // Override with registry-specific features
      ...registryEntry?.features
    },
    
    // Custom styles from registry
    customStyles: registryEntry?.customStyles
  };
};

/**
 * Load node configurations from backend NodeTypes
 */
export const loadNodeConfigurations = async (backendNodeTypes: any[]): Promise<void> => {
  const configurations: Record<string, NodeConfiguration> = {};
  
  for (const backendNodeType of backendNodeTypes) {
    try {
      const config = buildNodeConfiguration(backendNodeType);
      configurations[config.id] = config;
    } catch (error) {
      console.warn(`Failed to build configuration for node type ${backendNodeType.id}:`, error);
    }
  }
  
  NODE_CONFIGURATIONS = configurations;
  isConfigurationLoaded = true;
  
  console.log('✅ Node configurations loaded:', Object.keys(configurations));
};

/**
 * Get configuration with fallback for unknown types
 */
export const getNodeConfiguration = (nodeTypeId: string): NodeConfiguration | null => {
  if (!isConfigurationLoaded) {
    console.warn('Node configurations not loaded yet. Call loadNodeConfigurations() first.');
  }
  
  return NODE_CONFIGURATIONS[nodeTypeId] || null;
};

/**
 * Get configuration with guaranteed fallback
 */
export const getSafeNodeConfiguration = (nodeTypeId: string): NodeConfiguration => {
  const config = getNodeConfiguration(nodeTypeId);
  
  if (config) return config;
  
  // Fallback configuration for unknown node types
  return {
    id: nodeTypeId,
    category: NodeCategory.PROCESSOR,
    subcategory: 'Unknown',
    name: 'Unknown Node',
    description: 'Unknown node type',
    icon: NODE_ICONS['default'],
    color: '#757575',
    componentName: 'DefaultNode',
    features: {
      hasSettings: false,
      hasExecution: false,
      hasCustomUI: false,
      hasStatusIndicator: false
    },
    ports: {
      maxInputs: 0,
      maxOutputs: 0,
      requiredInputs: [],
      requiredOutputs: []
    }
  };
};

export const getAllNodeConfigurations = (): NodeConfiguration[] => {
  return Object.values(NODE_CONFIGURATIONS);
};

export const getNodesByCategory = (category: NodeCategory): NodeConfiguration[] => {
  return getAllNodeConfigurations().filter(config => config.category === category);
};

export const getNodesBySubcategory = (subcategory: string): NodeConfiguration[] => {
  return getAllNodeConfigurations().filter(config => config.subcategory === subcategory);
};

export const getCategoryColor = (category: NodeCategory): string => {
  return CATEGORY_COLORS[category] || '#757575';
};

export const getNodeIcon = (nodeTypeId: string): NodeIconComponent => {
  const config = getNodeConfiguration(nodeTypeId);
  return config?.icon || NODE_ICONS['default'];
};

// Validation helpers
export const validateNodeConfiguration = (config: NodeConfiguration): boolean => {
  return !!(
    config.id &&
    config.name &&
    config.category &&
    config.icon &&
    config.color &&
    config.componentName
  );
};

export const getRegisteredNodeIds = (): string[] => {
  return Object.keys(NODE_CONFIGURATIONS);
};

export const isConfigurationReady = (): boolean => {
  return isConfigurationLoaded;
};
