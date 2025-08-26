// TelegramInputNode Executor - orchestrates Telegram trigger nodes
// Minimal specialization: triggers execution with optional config, no user input

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

export class TelegramInputNodeExecutor extends NodeExecutor {
  constructor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void
  ) {
    super(nodeId, instance, nodeType, onNodeUpdate);
  }

  /**
   * Execute the Telegram trigger to verify webhook readiness (no inputs needed)
   */
  async executeConfigured(flowId: number): Promise<NodeExecutionResult> {
    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: {},
    };
    return await this.execute(context);
  }

  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    // Telegram trigger accepts empty inputs; just ensure object
    if (inputs === null || typeof inputs !== 'object') {
      throw new Error('Invalid inputs provided');
    }
  }
}
