// Node Executor Interface - SOLID-compliant external orchestration
// Allows ChatBotExecutionDialog and other orchestrators to execute nodes
// while preserving all existing rendering, status updates, and data inspection

import { NodeInstance, NodeType, NodeExecutionStatus } from '../../../types/nodes';
import { NodeExecutionService } from '../../../services/NodeExecutionService';
import { NodeExecutionManager } from './NodeExecutionManager';

/**
 * Execution context for node orchestration
 */
export interface NodeExecutionContext {
  nodeId: string;
  flowId: number;
  inputs: Record<string, any>;
  settings?: Record<string, any>;
}

/**
 * Execution result from node orchestration
 */
export interface NodeExecutionResult {
  success: boolean;
  outputs: Record<string, any>;
  status: NodeExecutionStatus;
  message?: string;
  metadata?: Record<string, any>;
  executionTime?: number;
}

/**
 * Node update callback for orchestrated execution
 */
export type NodeUpdateCallback = (nodeId: string, updates: Partial<NodeInstance>) => void;

/**
 * Abstract base class for node executors following SOLID principles
 * Provides common orchestration functionality while allowing specialization
 */
export abstract class NodeExecutor {
  protected nodeId: string;
  protected instance: NodeInstance;
  protected nodeType: NodeType;
  protected executionService: NodeExecutionService;
  protected executionManager: NodeExecutionManager;
  protected onNodeUpdate?: NodeUpdateCallback;

  constructor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    onNodeUpdate?: NodeUpdateCallback
  ) {
    this.nodeId = nodeId;
    this.instance = instance;
    this.nodeType = nodeType;
    this.executionService = NodeExecutionService.getInstance();
    this.executionManager = NodeExecutionManager.getInstance();
    this.onNodeUpdate = onNodeUpdate;
  }

  /**
   * Execute the node with provided inputs while preserving settings
   * This is the main orchestration method that external systems call
   */
  async execute(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      // 1. Validate inputs (can be overridden by subclasses)
      await this.validateInputs(context.inputs);
      
      // 2. Prepare execution context with preserved settings
      const executionContext = await this.prepareExecutionContext(context);
      
      // 3. Set status to RUNNING for UI feedback
      this.executionManager.setStatus(
        this.nodeId, 
        NodeExecutionStatus.RUNNING, 
        'Executing via orchestration...'
      );
      
      // 4. Execute through existing NodeExecutionService (preserves all architecture)
      const result = await this.executionService.executeNode(
        executionContext,
        this.onNodeUpdate,
        undefined, // onExecutionComplete - handled by orchestrator
        undefined  // inputCollector - inputs already provided
      );
      
      // 5. Process results (can be customized by subclasses)
      await this.processExecutionResult(result);
      
      // 6. Update node state if callback provided
      if (this.onNodeUpdate && result.success) {
        await this.updateNodeState(result);
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: result.success,
        outputs: result.outputs || {},
        status: result.status,
        message: result.success ? 'Execution completed successfully' : 'Execution failed',
        metadata: result.metadata,
        executionTime
      };
      
    } catch (error: any) {
      // Set error status for UI feedback
      this.executionManager.setStatus(
        this.nodeId,
        NodeExecutionStatus.ERROR,
        error.message || 'Execution failed'
      );
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        outputs: {},
        status: NodeExecutionStatus.ERROR,
        message: error.message || 'Execution failed',
        executionTime
      };
    }
  }

  /**
   * Get current node settings (preserved during orchestration)
   */
  protected getCurrentSettings(): Record<string, any> {
    return this.instance?.data?.settings || {};
  }

  /**
   * Validate inputs before execution (can be overridden)
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    // Base validation - subclasses can override for specific validation
    if (!inputs || typeof inputs !== 'object') {
      throw new Error('Invalid inputs provided');
    }
  }

  /**
   * Prepare execution context with preserved settings
   */
  protected async prepareExecutionContext(context: NodeExecutionContext): Promise<any> {
    const currentSettings = this.getCurrentSettings();
    
    return {
      nodeId: context.nodeId,
      flowId: context.flowId,
      settings: { ...currentSettings, ...(context.settings || {}) },
      inputs: context.inputs
    };
  }

  /**
   * Process execution result (can be customized by subclasses)
   */
  protected async processExecutionResult(result: any): Promise<any> {
    // Base processing - subclasses can override for custom processing
    return result;
  }

  /**
   * Update node state after successful execution
   */
  protected async updateNodeState(result: any): Promise<void> {
    if (!this.onNodeUpdate) return;
    
    this.onNodeUpdate(this.nodeId, {
      data: {
        ...(this.instance?.data || {}),
        lastExecution: {
          status: result.status,
          outputs: result.outputs || {},
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          executionTime: result.executionTime
        },
        outputs: result.outputs || {}
      },
      updatedAt: new Date()
    });
  }

  /**
   * Get current execution status
   */
  getExecutionStatus(): NodeExecutionStatus {
    return this.executionManager.getStatus(this.nodeId);
  }

  /**
   * Subscribe to status changes for real-time updates
   */
  subscribeToStatus(callback: (status: NodeExecutionStatus, message?: string) => void): () => void {
    return this.executionManager.subscribe(this.nodeId, (_, statusData) => {
      callback(statusData.status, statusData.message);
    });
  }

  /**
   * Get node type information
   */
  getNodeType(): NodeType {
    return this.nodeType;
  }

  /**
   * Get node instance information
   */
  getNodeInstance(): NodeInstance {
    return this.instance;
  }
}
