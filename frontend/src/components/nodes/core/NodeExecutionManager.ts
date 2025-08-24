// NodeExecutionManager - Centralized real-time execution status management
// Follows Single Responsibility Principle: Only manages execution state
// Provides real-time updates without manual state management

import { NodeExecutionStatus } from '../../../types/nodes';

/**
 * Execution state for a single node
 */
export interface NodeExecutionState {
  status: NodeExecutionStatus;
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
  outputs?: Record<string, any>;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Callback function for status change notifications
 */
export type StatusChangeCallback = (nodeId: string, state: NodeExecutionState) => void;

/**
 * Subscription for status change notifications
 */
interface StatusSubscription {
  nodeId: string;
  callback: StatusChangeCallback;
  id: string;
}

/**
 * Centralized manager for node execution states
 * 
 * This class follows SOLID principles:
 * - Single Responsibility: Only manages execution state
 * - Open/Closed: Extensible through callbacks, closed for modification
 * - Dependency Inversion: Uses abstractions (callbacks) not concrete implementations
 * 
 * Benefits:
 * - Real-time status updates across all components
 * - No manual state management needed in UI components
 * - Centralized source of truth for execution state
 * - Type-safe status management
 * - Automatic cleanup and memory management
 */
export class NodeExecutionManager {
  private static instance: NodeExecutionManager;
  private executionStates: Map<string, NodeExecutionState> = new Map();
  private subscriptions: Map<string, StatusSubscription[]> = new Map();
  private globalSubscriptions: StatusSubscription[] = [];
  private subscriptionCounter = 0;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): NodeExecutionManager {
    if (!NodeExecutionManager.instance) {
      NodeExecutionManager.instance = new NodeExecutionManager();
    }
    return NodeExecutionManager.instance;
  }

  /**
   * Set execution status for a node
   * Automatically notifies all subscribers
   */
  public setStatus(
    nodeId: string, 
    status: NodeExecutionStatus, 
    message?: string,
    metadata?: Record<string, any>
  ): void {
    const currentState = this.executionStates.get(nodeId) || {
      status: NodeExecutionStatus.PENDING
    };

    const newState: NodeExecutionState = {
      ...currentState,
      status,
      message,
      metadata: { ...currentState.metadata, ...metadata }
    };

    // Set timestamps based on status
    if (status === NodeExecutionStatus.RUNNING && !currentState.startedAt) {
      newState.startedAt = new Date();
    }
    
    if ([NodeExecutionStatus.SUCCESS, NodeExecutionStatus.ERROR, NodeExecutionStatus.SKIPPED].includes(status)) {
      newState.completedAt = new Date();
    }

    this.executionStates.set(nodeId, newState);
    this.notifySubscribers(nodeId, newState);
  }

  /**
   * Set execution outputs for a node
   */
  public setOutputs(nodeId: string, outputs: Record<string, any>): void {
    const currentState = this.executionStates.get(nodeId) || {
      status: NodeExecutionStatus.PENDING
    };

    const newState: NodeExecutionState = {
      ...currentState,
      outputs,
      status: currentState.status === NodeExecutionStatus.RUNNING 
        ? NodeExecutionStatus.SUCCESS 
        : currentState.status
    };

    this.executionStates.set(nodeId, newState);
    this.notifySubscribers(nodeId, newState);
  }

  /**
   * Set execution error for a node
   */
  public setError(nodeId: string, error: string): void {
    const currentState = this.executionStates.get(nodeId) || {
      status: NodeExecutionStatus.PENDING
    };

    const newState: NodeExecutionState = {
      ...currentState,
      status: NodeExecutionStatus.ERROR,
      error,
      completedAt: new Date()
    };

    this.executionStates.set(nodeId, newState);
    this.notifySubscribers(nodeId, newState);
  }

  /**
   * Get current execution status for a node
   */
  public getStatus(nodeId: string): NodeExecutionStatus {
    return this.executionStates.get(nodeId)?.status || NodeExecutionStatus.PENDING;
  }

  /**
   * Get complete execution state for a node
   */
  public getState(nodeId: string): NodeExecutionState | null {
    return this.executionStates.get(nodeId) || null;
  }

  /**
   * Check if node is currently executing
   */
  public isExecuting(nodeId: string): boolean {
    return this.getStatus(nodeId) === NodeExecutionStatus.RUNNING;
  }

  /**
   * Check if node has completed successfully
   */
  public isSuccess(nodeId: string): boolean {
    return this.getStatus(nodeId) === NodeExecutionStatus.SUCCESS;
  }

  /**
   * Check if node has error
   */
  public isError(nodeId: string): boolean {
    return this.getStatus(nodeId) === NodeExecutionStatus.ERROR;
  }

  /**
   * Subscribe to status changes for a specific node
   * Returns unsubscribe function
   */
  public subscribe(nodeId: string, callback: StatusChangeCallback): () => void {
    const subscription: StatusSubscription = {
      nodeId,
      callback,
      id: `sub_${++this.subscriptionCounter}`
    };

    if (!this.subscriptions.has(nodeId)) {
      this.subscriptions.set(nodeId, []);
    }
    this.subscriptions.get(nodeId)!.push(subscription);

    // Immediately notify with current state if exists
    const currentState = this.executionStates.get(nodeId);
    if (currentState) {
      callback(nodeId, currentState);
    }

    // Return unsubscribe function
    return () => {
      const nodeSubscriptions = this.subscriptions.get(nodeId);
      if (nodeSubscriptions) {
        const index = nodeSubscriptions.findIndex(sub => sub.id === subscription.id);
        if (index > -1) {
          nodeSubscriptions.splice(index, 1);
        }
        if (nodeSubscriptions.length === 0) {
          this.subscriptions.delete(nodeId);
        }
      }
    };
  }

  /**
   * Subscribe to all status changes (global subscription)
   * Returns unsubscribe function
   */
  public subscribeGlobal(callback: StatusChangeCallback): () => void {
    const subscription: StatusSubscription = {
      nodeId: '*',
      callback,
      id: `global_sub_${++this.subscriptionCounter}`
    };

    this.globalSubscriptions.push(subscription);

    // Return unsubscribe function
    return () => {
      const index = this.globalSubscriptions.findIndex(sub => sub.id === subscription.id);
      if (index > -1) {
        this.globalSubscriptions.splice(index, 1);
      }
    };
  }

  /**
   * Reset execution state for a node
   */
  public reset(nodeId: string): void {
    this.executionStates.delete(nodeId);
    this.notifySubscribers(nodeId, {
      status: NodeExecutionStatus.PENDING
    });
  }

  /**
   * Reset all execution states
   */
  public resetAll(): void {
    const nodeIds = Array.from(this.executionStates.keys());
    this.executionStates.clear();
    
    // Notify all subscribers of reset
    nodeIds.forEach(nodeId => {
      this.notifySubscribers(nodeId, {
        status: NodeExecutionStatus.PENDING
      });
    });
  }

  /**
   * Get all current execution states
   */
  public getAllStates(): Map<string, NodeExecutionState> {
    return new Map(this.executionStates);
  }

  /**
   * Notify subscribers of status change
   */
  private notifySubscribers(nodeId: string, state: NodeExecutionState): void {
    // Notify node-specific subscribers
    const nodeSubscriptions = this.subscriptions.get(nodeId);
    if (nodeSubscriptions) {
      nodeSubscriptions.forEach(subscription => {
        try {
          subscription.callback(nodeId, state);
        } catch (error) {
          console.error(`Error in status change callback for node ${nodeId}:`, error);
        }
      });
    }

    // Notify global subscribers
    this.globalSubscriptions.forEach(subscription => {
      try {
        subscription.callback(nodeId, state);
      } catch (error) {
        console.error(`Error in global status change callback:`, error);
      }
    });
  }

  /**
   * Clean up resources (for testing or app shutdown)
   */
  public cleanup(): void {
    this.executionStates.clear();
    this.subscriptions.clear();
    this.globalSubscriptions.length = 0;
    this.subscriptionCounter = 0;
  }
}

// Export singleton instance for easy access
export const nodeExecutionManager = NodeExecutionManager.getInstance();
