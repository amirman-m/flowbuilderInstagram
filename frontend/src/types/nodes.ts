import { Node, Edge } from '@xyflow/react';
import { JSONSchema7 } from 'json-schema';

// ============================================================================
// CORE NODE SYSTEM TYPES
// ============================================================================

/**
 * Enum defining the three main categories of nodes in our flow system
 * - TRIGGER: Nodes that start a flow execution (e.g., Instagram comment received)
 * - PROCESSOR: Nodes that process data (e.g., LLM response generation, text transformation)
 * - ACTION: Nodes that perform actions (e.g., send reply, call webhook)
 */
export enum NodeCategory {
  TRIGGER = 'trigger',
  PROCESSOR = 'processor',
  ACTION = 'action'
}

/**
 * Status of a node execution
 */
export enum NodeExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  ERROR = 'error',
  SKIPPED = 'skipped'
}

/**
 * Data types supported by node ports (inputs/outputs)
 */
export enum NodeDataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  OBJECT = 'object',
  ARRAY = 'array',
  ANY = 'any'
}

// ============================================================================
// NODE PORT DEFINITIONS
// ============================================================================

/**
 * Defines a single input or output port on a node
 * Ports are connection points where data flows between nodes
 */
export interface NodePort {
  /** Unique identifier for this port within the node */
  id: string;
  
  /** Internal name used for referencing in code */
  name: string;
  
  /** Human-readable label displayed in UI */
  label: string;
  
  /** Optional description explaining what this port does */
  description?: string;
  
  /** Data type that this port accepts/produces */
  dataType: NodeDataType;
  
  /** Whether this port is required for node execution */
  required: boolean;
  
  /** Default value if no connection is made (for inputs only) */
  defaultValue?: any;
  
  /** Whether this port accepts multiple connections */
  multiple?: boolean;
}

/**
 * Collection of input and output ports for a node type
 */
export interface NodePortsSchema {
  /** Input ports that receive data from other nodes */
  inputs: NodePort[];
  
  /** Output ports that send data to other nodes */
  outputs: NodePort[];
}

// ============================================================================
// NODE TYPE DEFINITION
// ============================================================================

/**
 * Complete definition of a node type that can be instantiated in flows
 * This represents the "template" or "blueprint" for creating node instances
 */
export interface NodeType {
  /** Unique identifier for this node type */
  id: string;
  
  /** Human-readable name displayed in UI */
  name: string;
  
  /** Detailed description of what this node does */
  description: string;
  
  /** Category this node belongs to */
  category: NodeCategory;
  
  /** Version of this node type for compatibility */
  version: string;
  
  /** Icon identifier for UI display */
  icon?: string;
  
  /** Color theme for visual representation */
  color?: string;
  
  /** Input and output port definitions */
  ports: NodePortsSchema;
  
  /** JSON Schema defining the structure of node settings/configuration */
  settingsSchema: JSONSchema7;
  
  /** Whether this node type is deprecated */
  deprecated?: boolean;
  
  /** Tags for categorization and search */
  tags?: string[];
  
  /** Documentation URL or help text */
  documentation?: string;
}

// ============================================================================
// NODE INSTANCE DEFINITIONS
// ============================================================================

/**
 * Runtime execution result for a node
 */
export interface NodeExecutionResult {
  /** Execution status */
  status: NodeExecutionStatus;
  
  /** Output data produced by the node */
  outputs: Record<string, any>;
  
  /** Error message if execution failed */
  error?: string;
  
  /** Execution start time */
  startedAt: Date;
  
  /** Execution completion time */
  completedAt?: Date;
  
  /** Additional metadata about execution */
  metadata?: Record<string, any>;
}

/**
 * An instance of a node type placed in a specific flow
 * This represents an actual node on the canvas with its configuration
 */
export interface NodeInstance {
  /** Unique identifier for this node instance */
  id: string;
  
  /** Reference to the node type this instance is based on */
  typeId: string;
  
  /** Human-readable label for this instance */
  label: string;
  
  /** Position on the flow canvas */
  position: {
    x: number;
    y: number;
  };
  
  /** Configuration data for this node instance */
  data: {
    /** User-configured settings based on the node type's settings schema */
    settings: Record<string, any>;
    
    /** Current input values (may come from connections or default values) */
    inputs: Record<string, any>;
    
    /** Last execution result */
    lastExecution?: NodeExecutionResult;
    
    /** Whether this node is disabled */
    disabled?: boolean;
    
    /** Custom styling overrides */
    style?: Record<string, any>;
  };
  
  /** Timestamp when this instance was created */
  createdAt: Date;
  
  /** Timestamp when this instance was last modified */
  updatedAt: Date;
}

// ============================================================================
// CONNECTION DEFINITIONS
// ============================================================================

/**
 * Represents a connection between two nodes in a flow
 * Data flows from source node's output port to target node's input port
 */
export interface NodeConnection {
  /** Unique identifier for this connection */
  id: string;
  
  /** ID of the source node instance */
  sourceNodeId: string;
  
  /** ID of the source node's output port */
  sourcePortId: string;
  
  /** ID of the target node instance */
  targetNodeId: string;
  
  /** ID of the target node's input port */
  targetPortId: string;
  
  /** Optional label for this connection */
  label?: string;
  
  /** Whether this connection is conditional */
  conditional?: boolean;
  
  /** Condition expression (if conditional) */
  condition?: string;
}

// ============================================================================
// FLOW DEFINITIONS
// ============================================================================

/**
 * Status of a flow
 */
export enum FlowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error'
}

/**
 * Complete flow definition containing nodes and their connections
 */
export interface FlowDefinition {
  /** Unique identifier for this flow */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Optional description */
  description?: string;
  
  /** All node instances in this flow */
  nodes: NodeInstance[];
  
  /** All connections between nodes */
  connections: NodeConnection[];
  
  /** Current status of the flow */
  status: FlowStatus;
  
  /** Version number for change tracking */
  version: number;
  
  /** Metadata about the flow */
  metadata?: {
    /** Flow canvas viewport settings */
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
    
    /** Custom flow-level settings */
    settings?: Record<string, any>;
    
    /** Tags for organization */
    tags?: string[];
  };
  
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// REACT FLOW INTEGRATION TYPES
// ============================================================================

/**
 * Extended React Flow node type with our custom data structure
 * This bridges our node system with React Flow's visualization
 */
export interface FlowNode extends Node {
  /** Node type category for rendering */
  type: NodeCategory;
  
  /** Custom data extending React Flow's base data */
  data: {
    /** Reference to the node type definition */
    nodeType: NodeType;
    
    /** Current node instance data */
    instance: NodeInstance;
    
    /** Whether this node is currently selected */
    selected?: boolean;
    
    /** Whether this node is currently being executed */
    executing?: boolean;
    
    /** Validation errors for this node */
    errors?: string[];
  };
}

/**
 * Extended React Flow edge type with our custom connection data
 */
export interface FlowEdge extends Edge {
  /** Source output port ID */
  sourcePortId: string;
  
  /** Target input port ID */
  targetPortId: string;
  
  /** Whether this connection is conditional */
  conditional?: boolean;
  
  /** Data type flowing through this connection */
  dataType?: NodeDataType;
  
  /** Whether this connection has validation errors */
  hasError?: boolean;
}

// ============================================================================
// VALIDATION AND ERROR TYPES
// ============================================================================

/**
 * Validation error for node configuration
 */
export interface NodeValidationError {
  /** Node instance ID where error occurred */
  nodeId: string;
  
  /** Type of validation error */
  type: 'settings' | 'connection' | 'data' | 'execution';
  
  /** Human-readable error message */
  message: string;
  
  /** Field path where error occurred (for settings errors) */
  field?: string;
  
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Complete validation result for a flow
 */
export interface FlowValidationResult {
  /** Whether the flow is valid */
  isValid: boolean;
  
  /** List of all validation errors */
  errors: NodeValidationError[];
  
  /** List of warnings that don't prevent execution */
  warnings: NodeValidationError[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Filter options for node type queries
 */
export interface NodeTypeFilter {
  /** Filter by category */
  category?: NodeCategory;
  
  /** Search by name or description */
  search?: string;
  
  /** Filter by tags */
  tags?: string[];
  
  /** Include deprecated node types */
  includeDeprecated?: boolean;
}

/**
 * Options for node execution
 */
export interface NodeExecutionOptions {
  /** Whether to execute in test mode */
  testMode?: boolean;
  
  /** Timeout in milliseconds */
  timeout?: number;
  
  /** Additional context data */
  context?: Record<string, any>;
}
