// Hook for node validation and settings validation
import { useMemo, useCallback } from 'react';
import { NodeConfiguration } from '../../../config/nodeConfiguration';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface UseNodeValidationProps {
  config: NodeConfiguration;
  settings?: Record<string, any>;
  connections?: {
    inputs: Array<{ id: string; connected: boolean }>;
    outputs: Array<{ id: string; connected: boolean }>;
  };
}

export interface UseNodeValidationReturn {
  // Validation results
  settingsValidation: ValidationResult;
  connectionValidation: ValidationResult;
  overallValidation: ValidationResult;
  
  // Validation state
  isReadyForExecution: boolean;
  hasWarnings: boolean;
  hasErrors: boolean;
  
  // Validation functions
  validateSettings: (settings: Record<string, any>) => ValidationResult;
  validateConnections: () => ValidationResult;
  validateAll: () => ValidationResult;
}

/**
 * Reusable hook for node validation including settings and connections.
 * Provides comprehensive validation with detailed error and warning messages.
 */
export const useNodeValidation = ({
  config,
  settings = {},
  connections
}: UseNodeValidationProps): UseNodeValidationReturn => {
  
  // Validate node settings
  const validateSettings = useCallback((nodeSettings: Record<string, any>): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if node requires settings but none are provided
    if (config.features?.hasSettings && Object.keys(nodeSettings).length === 0) {
      warnings.push('Node has configurable settings but none are set');
    }
    
    // Validate required settings based on node type
    switch (config.category) {
      case 'trigger':
        // Trigger nodes might need specific validation
        if (config.id === 'telegram_input' && !nodeSettings.bot_token) {
          errors.push('Bot token is required for Telegram input');
        }
        break;
        
      case 'processor':
        // AI nodes need model configuration
        if (config.subcategory === 'Chat Models') {
          if (!nodeSettings.model) {
            errors.push('AI model selection is required');
          }
          if (!nodeSettings.system_prompt) {
            warnings.push('System prompt is recommended for better AI responses');
          }
        }
        break;
        
      case 'action':
        // Action nodes might need API keys or credentials
        if (config.subcategory === 'Telegram' && !nodeSettings.bot_token) {
          errors.push('Bot token is required for Telegram actions');
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [config]);
  
  // Validate node connections
  const validateConnections = useCallback((): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!connections) {
      return { isValid: true, errors, warnings };
    }
    
    // Check input connections
    const inputConnections = connections.inputs.filter(conn => conn.id === config.id);
    const outputConnections = connections.outputs.filter(conn => conn.id === config.id);
    
    // Validate required inputs
    if (config.ports?.requiredInputs) {
      const missingInputs = config.ports.requiredInputs.filter(
        inputId => !inputConnections.some(conn => conn.id === inputId)
      );
      if (missingInputs.length > 0) {
        errors.push(`Missing required input connections: ${missingInputs.join(', ')}`);
      }
    }
    
    // Validate input limits
    if (config.ports?.maxInputs && inputConnections.length > config.ports.maxInputs) {
      errors.push(`Too many input connections (${inputConnections.length}/${config.ports.maxInputs})`);
    }
    
    // Validate output limits  
    if (config.ports?.maxOutputs && outputConnections.length > config.ports.maxOutputs) {
      errors.push(`Too many output connections (${outputConnections.length}/${config.ports.maxOutputs})`);
    }
    
    // Check if node has inputs but none are connected (warning for processors/actions)
    if (config.category !== 'trigger' && config.ports?.maxInputs && config.ports.maxInputs > 0) {
      if (inputConnections.length === 0) {
        warnings.push('Node has no input connections');
      }
    }
    
    // Check if outputs are connected (warning)
    if (config.ports?.maxOutputs && config.ports.maxOutputs > 0 && outputConnections.length === 0) {
      warnings.push('Node outputs are not connected to other nodes');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [config, connections]);
  
  // Validate all aspects
  const validateAll = useCallback((): ValidationResult => {
    const settingsResult = validateSettings(settings);
    const connectionsResult = validateConnections();
    
    return {
      isValid: settingsResult.isValid && connectionsResult.isValid,
      errors: [...settingsResult.errors, ...connectionsResult.errors],
      warnings: [...settingsResult.warnings, ...connectionsResult.warnings]
    };
  }, [validateSettings, validateConnections, settings]);
  
  // Memoized validation results
  const settingsValidation = useMemo(() => validateSettings(settings), [validateSettings, settings]);
  const connectionValidation = useMemo(() => validateConnections(), [validateConnections]);
  const overallValidation = useMemo(() => validateAll(), [validateAll]);
  
  // Computed state
  const isReadyForExecution = overallValidation.isValid;
  const hasWarnings = overallValidation.warnings.length > 0;
  const hasErrors = overallValidation.errors.length > 0;
  
  return {
    // Validation results
    settingsValidation,
    connectionValidation,
    overallValidation,
    
    // Validation state
    isReadyForExecution,
    hasWarnings,
    hasErrors,
    
    // Validation functions
    validateSettings,
    validateConnections,
    validateAll
  };
};
