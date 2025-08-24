// Hook for common node actions (execute, settings, delete)
import { useCallback, useState } from 'react';
import { NodeConfiguration } from '../../../config/nodeConfiguration';
import { nodeService } from '../../../services/nodeService';

export interface UseNodeActionsProps {
  nodeId: string;
  nodeTypeId: string;
  flowId: number;
  config: NodeConfiguration;
  onNodeUpdate?: (nodeId: string, updates: any) => void;
  onNodeDelete?: (nodeId: string) => void;
}

export interface UseNodeActionsReturn {
  // Execution state
  isExecuting: boolean;
  executionResult: any;
  executionError: string | null;
  
  // Settings state
  settingsOpen: boolean;
  
  // Action handlers
  handleExecute: () => Promise<void>;
  handleSettings: () => void;
  handleDelete: () => void;
  handleCloseSettings: () => void;
  
  // Utility functions
  canExecute: boolean;
  hasSettings: boolean;
}

/**
 * Reusable hook that provides common node actions and state management.
 * Handles execution, settings dialog, and deletion with consistent behavior.
 */
export const useNodeActions = ({
  nodeId,
  nodeTypeId,
  flowId,
  config,
  onNodeUpdate,
  onNodeDelete
}: UseNodeActionsProps): UseNodeActionsReturn => {
  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  
  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Execute node
  const handleExecute = useCallback(async () => {
    if (!config.features?.hasExecution || isExecuting) return;
    
    try {
      setIsExecuting(true);
      setExecutionError(null);
      
      console.log(`🚀 Executing node ${nodeId} (${nodeTypeId})`);
      
      // Call node execution API
      const result = await nodeService.execution.executeNode(flowId, nodeId, {
        // Add any additional execution parameters here
      });
      
      setExecutionResult(result);
      
      // Update node state if callback provided
      if (onNodeUpdate) {
        onNodeUpdate(nodeId, {
          executionResult: result,
          lastExecuted: new Date().toISOString(),
          status: 'success'
        });
      }
      
      console.log(`✅ Node ${nodeId} executed successfully:`, result);
      
    } catch (error: any) {
      console.error(`❌ Node ${nodeId} execution failed:`, error);
      setExecutionError(error.message || 'Execution failed');
      
      // Update node state with error
      if (onNodeUpdate) {
        onNodeUpdate(nodeId, {
          executionError: error.message,
          lastExecuted: new Date().toISOString(),
          status: 'error'
        });
      }
    } finally {
      setIsExecuting(false);
    }
  }, [nodeId, nodeTypeId, flowId, config.features?.hasExecution, isExecuting, onNodeUpdate]);
  
  // Open settings dialog
  const handleSettings = useCallback(() => {
    if (!config.features?.hasSettings) return;
    setSettingsOpen(true);
  }, [config.features?.hasSettings]);
  
  // Close settings dialog
  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);
  
  // Delete node
  const handleDelete = useCallback(() => {
    if (onNodeDelete) {
      onNodeDelete(nodeId);
    }
  }, [nodeId, onNodeDelete]);
  
  // Computed properties
  const canExecute = Boolean(config.features?.hasExecution && !isExecuting);
  const hasSettings = Boolean(config.features?.hasSettings);
  
  return {
    // Execution state
    isExecuting,
    executionResult,
    executionError,
    
    // Settings state
    settingsOpen,
    
    // Action handlers
    handleExecute,
    handleSettings,
    handleDelete,
    handleCloseSettings,
    
    // Utility functions
    canExecute,
    hasSettings
  };
};
