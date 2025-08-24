import { useCallback, useMemo } from 'react';
import { Connection, Edge, Node, IsValidConnection } from '@xyflow/react';
import { NodeType, FlowNode, FlowEdge } from '../types/nodes';
import { 
  ConnectionValidator, 
  ConnectionAttempt, 
  ConnectionValidationResult 
} from '../services/connectionValidator';

// ============================================================================
// HOOK INTERFACES
// ============================================================================

/**
 * Options for connection validation hook
 */
export interface UseConnectionValidationOptions {
  /** Whether to show validation feedback in real-time */
  realTimeValidation?: boolean;
  
  /** Whether to prevent invalid connections from being created */
  preventInvalidConnections?: boolean;
  
  /** Custom validation rules (for extensibility) */
  customValidationRules?: (attempt: ConnectionAttempt) => ConnectionValidationResult | null;
}

/**
 * Return type for the connection validation hook
 */
export interface UseConnectionValidationReturn {
  /** Validate a connection attempt */
  validateConnection: (connection: Connection) => ConnectionValidationResult;
  
  /** Check if a connection is valid (quick boolean check) */
  isConnectionValid: (connection: Connection) => boolean;
  
  /** Get styled edges with validation feedback */
  getValidatedEdges: (edges: Edge[]) => FlowEdge[];
  
  /** Handle connection creation with validation */
  onConnect: (connection: Connection) => boolean;
  
  /** Handle connection validation before creation */
  isValidConnection: IsValidConnection<FlowEdge>;
  
  /** Get validation error message for a connection */
  getConnectionError: (connection: Connection) => string | null;
}

// ============================================================================
// CONNECTION VALIDATION HOOK
// ============================================================================

/**
 * React hook for connection validation in flow builder
 * Provides validation logic and visual feedback for node connections
 */
export function useConnectionValidation(
  nodes: Node[],
  nodeTypes: Record<string, NodeType>,
  options: UseConnectionValidationOptions = {}
): UseConnectionValidationReturn {
  
  const {
    realTimeValidation = true,
    preventInvalidConnections = true,
    customValidationRules
  } = options;
  
  /**
   * Create a connection attempt object from a React Flow connection
   */
  const createConnectionAttempt = useCallback((connection: Connection): ConnectionAttempt | null => {
    const sourceNode = nodes.find(node => node.id === connection.source);
    const targetNode = nodes.find(node => node.id === connection.target);
    
    if (!sourceNode || !targetNode) {
      return null;
    }
    
    // Get node types from the node data
    const sourceNodeData = sourceNode.data as FlowNode['data'];
    const targetNodeData = targetNode.data as FlowNode['data'];
    
    // Safely access the node type using the instance typeId with null checks
    const sourceNodeTypeId = sourceNodeData?.instance?.typeId || sourceNodeData?.instance?.type;
    const targetNodeTypeId = targetNodeData?.instance?.typeId || targetNodeData?.instance?.type;
    
    const sourceNodeType = sourceNodeData?.nodeType || (sourceNodeTypeId ? nodeTypes[sourceNodeTypeId] : undefined);
    const targetNodeType = targetNodeData?.nodeType || (targetNodeTypeId ? nodeTypes[targetNodeTypeId] : undefined);
    
    if (!sourceNodeType || !targetNodeType) {
      return null;
    }
    
    return {
      sourceNodeType,
      sourcePortId: connection.sourceHandle || 'default',
      targetNodeType,
      targetPortId: connection.targetHandle || 'default'
    };
  }, [nodes, nodeTypes]);
  
  /**
   * Validate a connection attempt
   */
  const validateConnection = useCallback((connection: Connection): ConnectionValidationResult => {
    const attempt = createConnectionAttempt(connection);
    
    if (!attempt) {
      return {
        isValid: false,
        errorMessage: 'Invalid connection: Could not find source or target node.',
        severity: 'error'
      };
    }
    
    // Apply custom validation rules first if provided
    if (customValidationRules) {
      const customResult = customValidationRules(attempt);
      if (customResult) {
        return customResult;
      }
    }
    
    // Apply standard validation
    return ConnectionValidator.validateConnectionWithFeedback(attempt).validation;
  }, [createConnectionAttempt, customValidationRules]);
  
  /**
   * Quick boolean check for connection validity
   */
  const isConnectionValid = useCallback((connection: Connection): boolean => {
    const result = validateConnection(connection);
    return result.isValid;
  }, [validateConnection]);
  
  /**
   * Get validation error message for a connection
   */
  const getConnectionError = useCallback((connection: Connection): string | null => {
    const result = validateConnection(connection);
    return result.isValid ? null : (result.errorMessage || 'Invalid connection');
  }, [validateConnection]);
  
  /**
   * Transform edges with validation styling
   */
  const getValidatedEdges = useCallback((edges: Edge[]): FlowEdge[] => {
    if (!realTimeValidation) {
      return edges as FlowEdge[];
    }
    
    return edges.map(edge => {
      const connection: Connection = {
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null
      };
      
      const attempt = createConnectionAttempt(connection);
      if (!attempt) {
        return {
          ...edge,
          hasError: true,
          style: { ...edge.style, stroke: '#f44336', strokeDasharray: '5,5' }
        } as FlowEdge;
      }
      
      const validationResult = ConnectionValidator.validateConnectionWithFeedback(attempt);
      
      return {
        ...edge,
        sourcePortId: attempt.sourcePortId,
        targetPortId: attempt.targetPortId,
        hasError: !validationResult.validation.isValid,
        style: {
          ...edge.style,
          ...validationResult.visualFeedback.edgeStyle
        },
        className: validationResult.visualFeedback.classNames.join(' '),
        label: !validationResult.validation.isValid ? validationResult.validation.errorMessage : undefined
      } as FlowEdge;
    });
  }, [realTimeValidation, createConnectionAttempt]);
  
  /**
   * Handle connection creation with validation
   */
  const onConnect = useCallback((connection: Connection): boolean => {
    const isValid = isConnectionValid(connection);
    
    if (!isValid && preventInvalidConnections) {
      // Show error message to user
      const errorMessage = getConnectionError(connection);
      if (errorMessage) {
        // You can integrate with your notification system here
        console.warn('Connection blocked:', errorMessage);
        
        // Optionally show a toast notification
        // toast.error(errorMessage);
      }
      return false;
    }
    
    return isValid;
  }, [isConnectionValid, preventInvalidConnections, getConnectionError]);
  
  /**
   * Validation function for React Flow's isValidConnection prop
   */
  const isValidConnection: IsValidConnection<FlowEdge> = useCallback((connectionOrEdge) => {
    if (!preventInvalidConnections) {
      return true; // Allow all connections if prevention is disabled
    }
    
    // Handle both Connection and Edge types
    const connection = connectionOrEdge as Connection;
    
    return isConnectionValid(connection);
  }, [isConnectionValid, preventInvalidConnections]);
  
  return {
    validateConnection,
    isConnectionValid,
    getValidatedEdges,
    onConnect,
    isValidConnection,
    getConnectionError
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook for getting connection validation status for a specific edge
 */
export function useEdgeValidation(
  edge: Edge,
  nodes: Node[],
  nodeTypes: Record<string, NodeType>
): {
  isValid: boolean;
  errorMessage?: string;
  suggestions?: string[];
} {
  return useMemo(() => {
    const connection: Connection = {
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null
    };
    
    const sourceNode = nodes.find(node => node.id === connection.source);
    const targetNode = nodes.find(node => node.id === connection.target);
    
    if (!sourceNode || !targetNode) {
      return {
        isValid: false,
        errorMessage: 'Invalid connection: Missing nodes'
      };
    }
    
    const sourceNodeData = sourceNode.data as FlowNode['data'];
    const targetNodeData = targetNode.data as FlowNode['data'];
    
    // Safely access the node type using the instance typeId with null checks
    const sourceNodeTypeId = sourceNodeData?.instance?.typeId || sourceNodeData?.instance?.type;
    const targetNodeTypeId = targetNodeData?.instance?.typeId || targetNodeData?.instance?.type;
    
    const sourceNodeType = sourceNodeData?.nodeType || (sourceNodeTypeId ? nodeTypes[sourceNodeTypeId] : undefined);
    const targetNodeType = targetNodeData?.nodeType || (targetNodeTypeId ? nodeTypes[targetNodeTypeId] : undefined);
    
    if (!sourceNodeType || !targetNodeType) {
      return {
        isValid: false,
        errorMessage: 'Invalid connection: Missing node types'
      };
    }
    
    const attempt: ConnectionAttempt = {
      sourceNodeType,
      sourcePortId: connection.sourceHandle || 'default',
      targetNodeType,
      targetPortId: connection.targetHandle || 'default'
    };
    
    const result = ConnectionValidator.validateConnectionWithFeedback(attempt);
    
    return {
      isValid: result.validation.isValid,
      errorMessage: result.validation.errorMessage,
      suggestions: result.validation.suggestions
    };
  }, [edge, nodes, nodeTypes]);
}

export default useConnectionValidation;
