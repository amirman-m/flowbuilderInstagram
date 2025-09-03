// TelegramGroupEventChecker Executor - checks Telegram webhook for join events

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

export class TelegramGroupEventCheckerNodeExecutor extends NodeExecutor {
  private lastInputs?: Record<string, any>;

  constructor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void
  ) {
    super(nodeId, instance, nodeType, onNodeUpdate);
  }

  // Convenience method to run with upstream message payload
  async executeWithMessageInput(messageInput: any, flowId: number): Promise<NodeExecutionResult> {
    const preparedInputs = this.prepareInputsFromMessage(messageInput);
    this.lastInputs = preparedInputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: preparedInputs
    };

    return await this.execute(context);
  }

  // Normalize inputs to { message_data: {...} }
  private prepareInputsFromMessage(messageInput: any): Record<string, any> {
    if (messageInput?.message_data && typeof messageInput.message_data === 'object') {
      return { message_data: messageInput.message_data };
    }

    if (messageInput && typeof messageInput === 'object') {
      return { message_data: messageInput };
    }

    // Fallback: wrap primitives
    return { message_data: { value: messageInput } };
  }

  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);
    if (!inputs.message_data || typeof inputs.message_data !== 'object') {
      throw new Error("Telegram Group Event Checker requires 'message_data' object input");
    }
  }

  protected async updateNodeState(result: any): Promise<void> {
    if (!this.onNodeUpdate) return;

    const nowIso = new Date().toISOString();
    const existingData: any = this.instance?.data || {};

    this.onNodeUpdate(this.nodeId, {
      data: {
        ...existingData,
        inputs: {
          ...(existingData.inputs || {}),
          ...(this.lastInputs || {})
        },
        lastExecution: {
          status: result.status,
          outputs: result.outputs || {},
          startedAt: nowIso,
          completedAt: nowIso,
          executionTime: result.executionTime
        },
        outputs: result.outputs || {}
      },
      updatedAt: new Date()
    });
  }
}
