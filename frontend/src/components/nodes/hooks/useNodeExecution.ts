// src/components/nodes/hooks/useNodeExecution.ts
import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { nodeExecutionService } from '../../../services/NodeExecutionService';
import { useNodeExecutionStatus } from './useNodeExecutionStatus';
import { useNodeInputs } from './useNodeInputs';

export interface UseNodeExecutionProps {
  nodeId: string;
  settings: Record<string, any>;
  requiredSettings?: string[];
  onNodeUpdate?: (nodeId: string, updates: any) => void;
  onExecutionComplete?: (nodeId: string, result: any) => void;
}

/**
 * Simplified hook for node execution using centralized NodeExecutionService
 * Eliminates duplicate execution logic and state management
 */
export const useNodeExecution = ({
  nodeId,
  settings,
  requiredSettings = [],
  onNodeUpdate,
  onExecutionComplete
}: UseNodeExecutionProps) => {
  const { flowId } = useParams<{ flowId: string }>();
  const { status, message, isExecuting, isSuccess, isError } = useNodeExecutionStatus(nodeId);
  const { collectInputs } = useNodeInputs(nodeId);

  // Validate settings and update status
  const validateSettings = useCallback(() => {
    return nodeExecutionService.validateSettings(nodeId, settings, requiredSettings);
  }, [nodeId, settings, requiredSettings]);

  // Execute node with centralized service
  const executeNode = useCallback(async (customInputs?: Record<string, any>) => {
    if (!validateSettings()) {
      return { success: false, error: 'Settings validation failed' };
    }

    const context = {
      nodeId,
      flowId: parseInt(flowId || '1'),
      settings,
      inputs: customInputs
    };

    return await nodeExecutionService.executeNode(
      context,
      onNodeUpdate,
      onExecutionComplete,
      customInputs ? undefined : collectInputs
    );
  }, [nodeId, flowId, settings, validateSettings, onNodeUpdate, onExecutionComplete, collectInputs]);

  return {
    // Execution methods
    executeNode,
    validateSettings,
    
    // Status from centralized manager
    status,
    message,
    isExecuting,
    isSuccess,
    isError,
    
    // Computed states
    isReadyForExecution: validateSettings(),
    
    // Utilities
    clearStatus: () => nodeExecutionService.clearExecutionStatus(nodeId)
  };
};
