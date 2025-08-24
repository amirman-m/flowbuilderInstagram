// useNodeExecutionStatus - React hook for real-time execution status
// Integrates with NodeExecutionManager for centralized state management
// Provides automatic re-rendering when status changes

import { useState, useEffect, useCallback } from 'react';
import { NodeExecutionStatus } from '../../../types/nodes';
import { nodeExecutionManager, NodeExecutionState } from '../core/NodeExecutionManager';

/**
 * Hook return type for node execution status
 */
export interface UseNodeExecutionStatusReturn {
  // Current state
  status: NodeExecutionStatus;
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
  outputs?: Record<string, any>;
  error?: string;
  metadata?: Record<string, any>;
  
  // Computed states
  isExecuting: boolean;
  isSuccess: boolean;
  isError: boolean;
  isPending: boolean;
  isCompleted: boolean;
  
  // Actions
  setStatus: (status: NodeExecutionStatus, message?: string, metadata?: Record<string, any>) => void;
  setOutputs: (outputs: Record<string, any>) => void;
  setError: (error: string) => void;
  reset: () => void;
}

/**
 * React hook for managing node execution status with real-time updates
 * 
 * This hook:
 * - Connects to centralized NodeExecutionManager
 * - Provides automatic re-rendering when status changes
 * - Eliminates need for manual state management in components
 * - Ensures consistent status across all UI components
 * 
 * @param nodeId - Unique identifier for the node
 * @returns Object with current status, computed states, and action functions
 * 
 * @example
 * ```tsx
 * function MyNodeComponent({ id }) {
 *   const {
 *     status,
 *     isExecuting,
 *     isSuccess,
 *     setStatus,
 *     setOutputs,
 *     setError
 *   } = useNodeExecutionStatus(id);
 * 
 *   const handleExecute = async () => {
 *     setStatus(NodeExecutionStatus.RUNNING, 'Starting execution...');
 *     try {
 *       const result = await executeNode();
 *       setOutputs(result.outputs);
 *       setStatus(NodeExecutionStatus.SUCCESS, 'Execution completed');
 *     } catch (error) {
 *       setError(error.message);
 *     }
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleExecute} disabled={isExecuting}>
 *         {isExecuting ? 'Executing...' : 'Execute'}
 *       </button>
 *       {isSuccess && <div>Success!</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export const useNodeExecutionStatus = (nodeId: string): UseNodeExecutionStatusReturn => {
  // Initialize state from manager
  const [executionState, setExecutionState] = useState<NodeExecutionState>(() => {
    return nodeExecutionManager.getState(nodeId) || {
      status: NodeExecutionStatus.PENDING
    };
  });

  // Subscribe to status changes
  useEffect(() => {
    const unsubscribe = nodeExecutionManager.subscribe(nodeId, (_, state) => {
      setExecutionState(state);
    });

    return unsubscribe;
  }, [nodeId]);

  // Action functions that update the manager (which triggers re-render via subscription)
  const setStatus = useCallback((
    status: NodeExecutionStatus, 
    message?: string, 
    metadata?: Record<string, any>
  ) => {
    nodeExecutionManager.setStatus(nodeId, status, message, metadata);
  }, [nodeId]);

  const setOutputs = useCallback((outputs: Record<string, any>) => {
    nodeExecutionManager.setOutputs(nodeId, outputs);
  }, [nodeId]);

  const setError = useCallback((error: string) => {
    nodeExecutionManager.setError(nodeId, error);
  }, [nodeId]);

  const reset = useCallback(() => {
    nodeExecutionManager.reset(nodeId);
  }, [nodeId]);

  // Computed states for convenience
  const isExecuting = executionState.status === NodeExecutionStatus.RUNNING;
  const isSuccess = executionState.status === NodeExecutionStatus.SUCCESS;
  const isError = executionState.status === NodeExecutionStatus.ERROR;
  const isPending = executionState.status === NodeExecutionStatus.PENDING;
  const isCompleted = [
    NodeExecutionStatus.SUCCESS, 
    NodeExecutionStatus.ERROR, 
    NodeExecutionStatus.SKIPPED
  ].includes(executionState.status);

  return {
    // Current state
    status: executionState.status,
    message: executionState.message,
    startedAt: executionState.startedAt,
    completedAt: executionState.completedAt,
    outputs: executionState.outputs,
    error: executionState.error,
    metadata: executionState.metadata,
    
    // Computed states
    isExecuting,
    isSuccess,
    isError,
    isPending,
    isCompleted,
    
    // Actions
    setStatus,
    setOutputs,
    setError,
    reset
  };
};

/**
 * Hook for subscribing to multiple node statuses
 * Useful for flow-level components that need to monitor multiple nodes
 * 
 * @param nodeIds - Array of node IDs to monitor
 * @returns Map of nodeId to execution state
 */
export const useMultipleNodeExecutionStatus = (nodeIds: string[]) => {
  const [executionStates, setExecutionStates] = useState<Map<string, NodeExecutionState>>(() => {
    const states = new Map<string, NodeExecutionState>();
    nodeIds.forEach(nodeId => {
      const state = nodeExecutionManager.getState(nodeId);
      if (state) {
        states.set(nodeId, state);
      }
    });
    return states;
  });

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    nodeIds.forEach(nodeId => {
      const unsubscribe = nodeExecutionManager.subscribe(nodeId, (_, state) => {
        setExecutionStates(prev => {
          const next = new Map(prev);
          next.set(nodeId, state);
          return next;
        });
      });
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [nodeIds]);

  return executionStates;
};

/**
 * Hook for global execution status monitoring
 * Useful for flow execution dialogs or global status indicators
 * 
 * @returns Object with global execution statistics
 */
export const useGlobalExecutionStatus = () => {
  const [allStates, setAllStates] = useState<Map<string, NodeExecutionState>>(() => {
    return nodeExecutionManager.getAllStates();
  });

  useEffect(() => {
    const unsubscribe = nodeExecutionManager.subscribeGlobal((id, state) => {
      setAllStates(prev => {
        const next = new Map(prev);
        next.set(id, state);
        return next;
      });
    });

    return unsubscribe;
  }, []);

  // Compute global statistics
  const totalNodes = allStates.size;
  const executingNodes = Array.from(allStates.values()).filter(
    state => state.status === NodeExecutionStatus.RUNNING
  ).length;
  const successNodes = Array.from(allStates.values()).filter(
    state => state.status === NodeExecutionStatus.SUCCESS
  ).length;
  const errorNodes = Array.from(allStates.values()).filter(
    state => state.status === NodeExecutionStatus.ERROR
  ).length;

  return {
    allStates,
    totalNodes,
    executingNodes,
    successNodes,
    errorNodes,
    isAnyExecuting: executingNodes > 0,
    allCompleted: totalNodes > 0 && (successNodes + errorNodes) === totalNodes
  };
};
