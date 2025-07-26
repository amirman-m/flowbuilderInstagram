import { NodeType, NodeDataType, NodePort } from '../types/nodes';

// ============================================================================
// CONNECTION VALIDATION INTERFACES
// ============================================================================

/**
 * Result of a connection validation check
 */
export interface ConnectionValidationResult {
  /** Whether the connection is valid */
  isValid: boolean;
  
  /** User-friendly error message if invalid */
  errorMessage?: string;
  
  /** Technical details for debugging */
  technicalDetails?: string;
  
  /** Severity level of the validation issue */
  severity: 'error' | 'warning' | 'info';
  
  /** Suggested alternative connections */
  suggestions?: string[];
}

/**
 * Connection attempt details
 */
export interface ConnectionAttempt {
  /** Source node type */
  sourceNodeType: NodeType;
  
  /** Source output port ID */
  sourcePortId: string;
  
  /** Target node type */
  targetNodeType: NodeType;
  
  /** Target input port ID */
  targetPortId: string;
}

/**
 * Port compatibility information
 */
export interface PortCompatibility {
  /** Source port details */
  sourcePort: NodePort;
  
  /** Target port details */
  targetPort: NodePort;
  
  /** Whether data types are compatible */
  dataTypeCompatible: boolean;
  
  /** Compatibility score (0-100) */
  compatibilityScore: number;
  
  /** Reason for incompatibility */
  incompatibilityReason?: string;
}

// ============================================================================
// DATA TYPE COMPATIBILITY RULES
// ============================================================================

/**
 * Defines which data types can be connected to which other data types
 * Key: target data type, Value: array of compatible source data types
 */
const DATA_TYPE_COMPATIBILITY_MATRIX: Record<NodeDataType, NodeDataType[]> = {
  [NodeDataType.STRING]: [
    NodeDataType.STRING,
    NodeDataType.ANY
  ],
  [NodeDataType.NUMBER]: [
    NodeDataType.NUMBER,
    NodeDataType.ANY
  ],
  [NodeDataType.BOOLEAN]: [
    NodeDataType.BOOLEAN,
    NodeDataType.ANY
  ],
  [NodeDataType.OBJECT]: [
    NodeDataType.OBJECT,
    NodeDataType.ANY
  ],
  [NodeDataType.ARRAY]: [
    NodeDataType.ARRAY,
    NodeDataType.ANY
  ],
  [NodeDataType.ANY]: [
    NodeDataType.STRING,
    NodeDataType.NUMBER,
    NodeDataType.BOOLEAN,
    NodeDataType.OBJECT,
    NodeDataType.ARRAY,
    NodeDataType.ANY
  ]
};

// ============================================================================
// USER-FRIENDLY ERROR MESSAGES
// ============================================================================

/**
 * Generates user-friendly error messages for common incompatibility scenarios
 */
class ConnectionErrorMessageGenerator {
  /**
   * Generate a user-friendly error message based on node types and port types
   */
  static generateErrorMessage(
    sourceNodeType: NodeType,
    sourcePort: NodePort,
    targetNodeType: NodeType,
    targetPort: NodePort
  ): string {
    // Special case mappings for common scenarios
    const specialCases = this.getSpecialCaseMessage(
      sourceNodeType,
      sourcePort,
      targetNodeType,
      targetPort
    );
    
    if (specialCases) {
      return specialCases;
    }
    
    // Generic data type mismatch message
    return this.generateGenericDataTypeMessage(sourcePort, targetPort);
  }
  
  /**
   * Handle special case error messages for specific node combinations
   */
  private static getSpecialCaseMessage(
    sourceNodeType: NodeType,
    sourcePort: NodePort,
    targetNodeType: NodeType,
    targetPort: NodePort
  ): string | null {
    // Voice Input -> Transcription (correct connection)
    if (sourceNodeType.id === 'voice_input' && targetNodeType.id === 'transcription') {
      return null; // This should be valid
    }
    
    // Text-based nodes -> Transcription (invalid)
    if (targetNodeType.id === 'transcription' && sourcePort.dataType === NodeDataType.STRING) {
      return "Text input cannot be connected to transcription model. Transcription needs voice input from a Voice Input node.";
    }
    
    // Voice Input -> Text-based processors (invalid)
    if (sourceNodeType.id === 'voice_input' && 
        (targetNodeType.id.includes('chat') || targetNodeType.id.includes('openai') || targetNodeType.id.includes('deepseek')) &&
        targetPort.dataType === NodeDataType.STRING) {
      return "Voice input cannot be directly connected to text chat models. Use a Transcription node first to convert voice to text.";
    }
    
    // Transcription -> Chat models (valid - this should work)
    if (sourceNodeType.id === 'transcription' && 
        (targetNodeType.id.includes('chat') || targetNodeType.id.includes('openai') || targetNodeType.id.includes('deepseek'))) {
      return null; // This should be valid
    }
    
    // Object output -> String input (common case)
    if (sourcePort.dataType === NodeDataType.OBJECT && targetPort.dataType === NodeDataType.STRING) {
      if (sourceNodeType.category === 'trigger' && targetNodeType.category === 'processor') {
        return `${sourceNodeType.name} outputs structured data, but ${targetNodeType.name} expects simple text. You may need a data transformation node.`;
      }
    }
    
    return null;
  }
  
  /**
   * Generate generic data type mismatch message
   */
  private static generateGenericDataTypeMessage(
    sourcePort: NodePort,
    targetPort: NodePort
  ): string {
    const sourceTypeLabel = this.getDataTypeLabel(sourcePort.dataType);
    const targetTypeLabel = this.getDataTypeLabel(targetPort.dataType);
    
    return `Cannot connect ${sourceTypeLabel} output to ${targetTypeLabel} input. Data types are not compatible.`;
  }
  
  /**
   * Get user-friendly labels for data types
   */
  private static getDataTypeLabel(dataType: NodeDataType): string {
    const labels: Record<NodeDataType, string> = {
      [NodeDataType.STRING]: 'text',
      [NodeDataType.NUMBER]: 'number',
      [NodeDataType.BOOLEAN]: 'true/false',
      [NodeDataType.OBJECT]: 'structured data',
      [NodeDataType.ARRAY]: 'list',
      [NodeDataType.ANY]: 'any type'
    };
    
    return labels[dataType] || dataType;
  }
}

// ============================================================================
// CONNECTION VALIDATION SERVICE
// ============================================================================

/**
 * Service responsible for validating node connections
 * Follows Single Responsibility Principle - only handles connection validation
 */
export class ConnectionValidationService {
  /**
   * Validate a connection attempt between two nodes
   */
  static validateConnection(attempt: ConnectionAttempt): ConnectionValidationResult {
    try {
      // Find the specific ports being connected
      const sourcePort = this.findPort(attempt.sourceNodeType.ports.outputs, attempt.sourcePortId);
      const targetPort = this.findPort(attempt.targetNodeType.ports.inputs, attempt.targetPortId);
      
      if (!sourcePort || !targetPort) {
        return {
          isValid: false,
          errorMessage: "Invalid port connection. Please check the connection points.",
          severity: 'error'
        };
      }
      
      // Check port compatibility
      const compatibility = this.checkPortCompatibility(sourcePort, targetPort);
      
      if (!compatibility.dataTypeCompatible) {
        const errorMessage = ConnectionErrorMessageGenerator.generateErrorMessage(
          attempt.sourceNodeType,
          sourcePort,
          attempt.targetNodeType,
          targetPort
        );
        
        return {
          isValid: false,
          errorMessage,
          technicalDetails: compatibility.incompatibilityReason,
          severity: 'error',
          suggestions: this.generateSuggestions(attempt)
        };
      }
      
      // Connection is valid
      return {
        isValid: true,
        severity: 'info'
      };
      
    } catch (error) {
      return {
        isValid: false,
        errorMessage: "An error occurred while validating the connection.",
        technicalDetails: error instanceof Error ? error.message : 'Unknown error',
        severity: 'error'
      };
    }
  }
  
  /**
   * Check if two ports are compatible for connection
   */
  private static checkPortCompatibility(sourcePort: NodePort, targetPort: NodePort): PortCompatibility {
    const sourceTypes = Array.isArray(sourcePort.dataType) ? sourcePort.dataType : [sourcePort.dataType];
    const targetTypes = Array.isArray(targetPort.dataType) ? targetPort.dataType : [targetPort.dataType];
    let compatibilityScore = 0;
    let incompatibilityReason = '';
    let isCompatible = false;
    
    // Check for an intersection between source and target data types
    for (const sourceType of sourceTypes) {
      for (const targetType of targetTypes) {
        const compatibleTypes = DATA_TYPE_COMPATIBILITY_MATRIX[targetPort.dataType as keyof typeof DATA_TYPE_COMPATIBILITY_MATRIX] || [];
        if (compatibleTypes.includes(sourceType)) {
          isCompatible = true;
          if (sourceType === targetType) {
            compatibilityScore = Math.max(compatibilityScore, 100); // Perfect match
          } else if (sourceType === NodeDataType.ANY || targetType === NodeDataType.ANY) {
            compatibilityScore = Math.max(compatibilityScore, 80); // Good match with ANY type
          } else {
            compatibilityScore = Math.max(compatibilityScore, 60); // Compatible but different types
          }
        }
      }
    }

    if (!isCompatible) {
      incompatibilityReason = `Source port types '${sourceTypes.join(', ')}' are not compatible with target port types '${targetTypes.join(', ')}'`;
    }
    
    return {
      sourcePort,
      targetPort,
      dataTypeCompatible: isCompatible,
      compatibilityScore,
      incompatibilityReason: isCompatible ? undefined : incompatibilityReason
    };
  }
  
  /**
   * Find a port by ID in a port array
   */
  private static findPort(ports: NodePort[], portId: string): NodePort | null {
    return ports.find(port => port.id === portId) || null;
  }
  
  /**
   * Generate suggestions for alternative connections
   */
  private static generateSuggestions(attempt: ConnectionAttempt): string[] {
    const suggestions: string[] = [];
    
    // Suggest compatible ports on the target node
    const compatibleInputs = attempt.targetNodeType.ports.inputs.filter(input => {
      const sourcePort = this.findPort(attempt.sourceNodeType.ports.outputs, attempt.sourcePortId);
      if (!sourcePort) return false;
      
      const compatibility = this.checkPortCompatibility(sourcePort, input);
      return compatibility.dataTypeCompatible;
    });
    
    if (compatibleInputs.length > 0) {
      suggestions.push(`Try connecting to the '${compatibleInputs[0].label}' input instead.`);
    }
    
    // Suggest intermediate nodes for common scenarios
    if (attempt.sourceNodeType.id === 'voice_input' && 
        (attempt.targetNodeType.id.includes('chat') || attempt.targetNodeType.id.includes('openai'))) {
      suggestions.push("Add a Transcription node between Voice Input and the chat model.");
    }
    
    return suggestions;
  }
}

// ============================================================================
// CONNECTION VISUAL FEEDBACK SERVICE
// ============================================================================

/**
 * Service responsible for providing visual feedback for connections
 * Follows Single Responsibility Principle - only handles visual aspects
 */
export class ConnectionVisualFeedbackService {
  /**
   * Get the appropriate edge style for a connection validation result
   */
  static getEdgeStyle(validationResult: ConnectionValidationResult): Record<string, any> {
    if (!validationResult.isValid) {
      return {
        stroke: '#f44336', // Red color for invalid connections
        strokeWidth: 2,
        strokeDasharray: '5,5', // Dashed line for errors
        opacity: 0.8
      };
    }
    
    return {
      stroke: '#4caf50', // Green color for valid connections
      strokeWidth: 2,
      opacity: 1
    };
  }
  
  /**
   * Get the appropriate edge class names for styling
   */
  static getEdgeClassNames(validationResult: ConnectionValidationResult): string[] {
    const classNames = ['connection-edge'];
    
    if (!validationResult.isValid) {
      classNames.push('connection-edge--invalid');
      classNames.push(`connection-edge--${validationResult.severity}`);
    } else {
      classNames.push('connection-edge--valid');
    }
    
    return classNames;
  }
  
  /**
   * Get tooltip content for connection feedback
   */
  static getTooltipContent(validationResult: ConnectionValidationResult): string {
    if (!validationResult.isValid) {
      return validationResult.errorMessage || 'Invalid connection';
    }
    
    return 'Valid connection';
  }
}

// ============================================================================
// MAIN CONNECTION VALIDATOR
// ============================================================================

/**
 * Main connection validator that orchestrates all validation services
 * Follows Open/Closed Principle - extensible without modification
 */
export class ConnectionValidator {
  /**
   * Validate a connection and return comprehensive result with visual feedback
   */
  static validateConnectionWithFeedback(attempt: ConnectionAttempt): {
    validation: ConnectionValidationResult;
    visualFeedback: {
      edgeStyle: Record<string, any>;
      classNames: string[];
      tooltip: string;
    };
  } {
    const validation = ConnectionValidationService.validateConnection(attempt);
    
    return {
      validation,
      visualFeedback: {
        edgeStyle: ConnectionVisualFeedbackService.getEdgeStyle(validation),
        classNames: ConnectionVisualFeedbackService.getEdgeClassNames(validation),
        tooltip: ConnectionVisualFeedbackService.getTooltipContent(validation)
      }
    };
  }
  
  /**
   * Quick validation check - returns only boolean result
   */
  static isConnectionValid(attempt: ConnectionAttempt): boolean {
    const result = ConnectionValidationService.validateConnection(attempt);
    return result.isValid;
  }
  
  /**
   * Get user-friendly error message for invalid connection
   */
  static getConnectionErrorMessage(attempt: ConnectionAttempt): string | null {
    const result = ConnectionValidationService.validateConnection(attempt);
    return result.isValid ? null : (result.errorMessage || 'Connection is not valid');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ConnectionValidator;
