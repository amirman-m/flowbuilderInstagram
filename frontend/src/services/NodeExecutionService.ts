// src/services/NodeExecutionService.ts
import { nodeService } from './nodeService';
import { NodeExecutionManager } from '../components/nodes/core/NodeExecutionManager';
import { NodeExecutionStatus } from '../types/nodes';
import type { AxiosError } from 'axios';
import { showAppSnackbar } from '../components/SnackbarProvider';
import { API_BASE_URL } from './api';

export interface ExecutionContext {
  nodeId: string;
  flowId: number;
  settings: Record<string, any>;
  inputs?: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  outputs?: Record<string, any>;
  error?: string;
  status: NodeExecutionStatus;
  startedAt: string;
  completedAt: string;
  executionTime?: number;
  metadata?: Record<string, any>;
}

export interface NodeUpdateHandler {
  (nodeId: string, updates: any): void;
}

export interface ExecutionCompleteHandler {
  (nodeId: string, result: ExecutionResult): void;
}

/**
 * Centralized service for node execution with real-time status management
 * Eliminates duplicate execution logic across all node types
 */
export class NodeExecutionService {
  private static instance: NodeExecutionService;
  private executionManager: NodeExecutionManager;

  private constructor() {
    this.executionManager = NodeExecutionManager.getInstance();
  }

  public static getInstance(): NodeExecutionService {
    if (!NodeExecutionService.instance) {
      NodeExecutionService.instance = new NodeExecutionService();
    }
    return NodeExecutionService.instance;
  }

  /**
   * Execute a node with centralized status management and error handling
   */
  public async executeNode(
    context: ExecutionContext,
    onNodeUpdate?: NodeUpdateHandler,
    onExecutionComplete?: ExecutionCompleteHandler,
    inputCollector?: () => Promise<Record<string, any>>
  ): Promise<ExecutionResult> {
    const { nodeId, flowId, settings, inputs: providedInputs } = context;
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    // Set initial running status
    this.executionManager.setStatus(nodeId, NodeExecutionStatus.RUNNING, 'Executing...');

    // Update node state to show running status
    if (onNodeUpdate) {
      onNodeUpdate(nodeId, {
        data: {
          lastExecution: {
            status: NodeExecutionStatus.RUNNING,
            outputs: {},
            startedAt
          },
          outputs: {}
        },
        updatedAt: new Date()
      });
    }

    try {
      // 1. Collect inputs if collector provided
      let inputs = providedInputs || {};
      if (inputCollector) {
        this.executionManager.setStatus(nodeId, NodeExecutionStatus.RUNNING, 'Collecting inputs...');
        
        inputs = await inputCollector();
        
        // Update node with collected inputs immediately
        if (onNodeUpdate) {
          onNodeUpdate(nodeId, {
            data: {
              inputs: inputs
            },
            updatedAt: new Date()
          });
        }
      }

      // 2. Execute node via backend API
      this.executionManager.setStatus(nodeId, NodeExecutionStatus.RUNNING, 'Processing...');

      const result = await nodeService.execution.executeNode(
        flowId,
        nodeId,
        inputs,
        settings
      );

      const completedAt = new Date().toISOString();
      const executionTime = Date.now() - startTime;

      if (result && result.outputs) {
        // Success path
        const executionResult: ExecutionResult = {
          success: true,
          outputs: result.outputs,
          status: NodeExecutionStatus.SUCCESS,
          startedAt,
          completedAt,
          executionTime,
          metadata: (result as any).metadata
        };

        // Update centralized status
        this.executionManager.setStatus(nodeId, NodeExecutionStatus.SUCCESS, 'Execution completed successfully', { executionTime });

        // Update node state
        if (onNodeUpdate) {
          onNodeUpdate(nodeId, {
            data: {
              lastExecution: {
                ...result,
                status: NodeExecutionStatus.SUCCESS,
                startedAt,
                completedAt,
                executionTime
              },
              outputs: result.outputs,
              inputs: inputs
            },
            updatedAt: new Date()
          });
        }

        // Emit execution complete event
        if (onExecutionComplete) {
          onExecutionComplete(nodeId, {
            ...executionResult,
            timestamp: completedAt
          } as any);
        }

        return executionResult;
      } else {
        // No outputs - treat as error
        throw new Error('Execution returned no outputs');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      const completedAt = new Date().toISOString();
      const executionTime = Date.now() - startTime;

      // Build informative error message for the user via snackbar
      const axErr = error as AxiosError<any>;
      const status = axErr?.response?.status;
      const statusText = axErr?.response?.statusText;
      const method = (axErr as any)?.config?.method?.toUpperCase?.() || 'POST';
      const cfgUrl = (axErr as any)?.config?.url as string | undefined;
      const cfgBase = (axErr as any)?.config?.baseURL as string | undefined;
      const urlPath = cfgUrl || `/flows/${flowId}/nodes/${nodeId}/execute`;
      const base = cfgBase || API_BASE_URL;
      const fullUrl = urlPath?.startsWith('http') ? urlPath : `${base}${urlPath}`;
      const backendReason = axErr?.response?.data?.detail || axErr?.response?.data?.message;

      // Status-specific hints (concise)
      let hint = '';
      if (status === 404) {
        hint = 'Possible causes: flow or node not found. please save the flow then try again';
      } else if (status === 401 || status === 403) {
        hint = 'Authentication/authorization required. Please log in again.';
      } else if (!status) {
        hint = 'Network error or server unavailable.';
      }

      const snackbarMessage = `Execution failed${status ? ` (${status}${statusText ? ' ' + statusText : ''})` : ''}: ${method} ${fullUrl}. ${backendReason || errorMsg}${hint ? ` — ${hint}` : ''}`;
      showAppSnackbar({ message: snackbarMessage, severity: 'error', duration: 8000 });

      const executionResult: ExecutionResult = {
        success: false,
        error: errorMsg,
        status: NodeExecutionStatus.ERROR,
        startedAt,
        completedAt,
        executionTime
      };

      // Update centralized status
      this.executionManager.setError(nodeId, errorMsg);

      // Update node state
      if (onNodeUpdate) {
        onNodeUpdate(nodeId, {
          data: {
            lastExecution: {
              status: NodeExecutionStatus.ERROR,
              outputs: {},
              error: errorMsg,
              startedAt,
              completedAt,
              executionTime
            }
          },
          updatedAt: new Date()
        });
      }

      // Emit execution complete event
      if (onExecutionComplete) {
        onExecutionComplete(nodeId, {
          ...executionResult,
          timestamp: completedAt
        } as any);
      }

      return executionResult;
    }
  }

  /**
   * Validate node settings and update status accordingly
   */
  public validateSettings(
    nodeId: string,
    settings: Record<string, any>,
    requiredFields: string[]
  ): boolean {
    const missingFields = requiredFields.filter(field => !settings[field]);
    
    if (missingFields.length > 0) {
      this.executionManager.setStatus(nodeId, NodeExecutionStatus.SKIPPED, `Missing required settings: ${missingFields.join(', ')}`);
      return false;
    }

    this.executionManager.setStatus(nodeId, NodeExecutionStatus.PENDING, 'Ready to execute');
    return true;
  }

  /**
   * Get execution status for a node
   */
  public getExecutionStatus(nodeId: string) {
    return this.executionManager.getStatus(nodeId);
  }

  /**
   * Clear execution status for a node
   */
  public clearExecutionStatus(nodeId: string) {
    this.executionManager.reset(nodeId);
  }
}

// Export singleton instance
export const nodeExecutionService = NodeExecutionService.getInstance();
