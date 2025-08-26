// SwitchInputTypeNode Executor - Orchestrates routing based on message_data input type

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for Switch Input Type nodes
 * Determines whether incoming payload is text/voice/other and emits on the correct output
 */
export class SwitchInputTypeNodeExecutor extends NodeExecutor {
  private lastInputs?: Record<string, any>;

  constructor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void
  ) {
    super(nodeId, instance, nodeType, onNodeUpdate);
  }

  /**
   * Convenience execution using upstream message payload
   */
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

  /**
   * Normalize various upstream formats to a consistent inputs shape
   */
  private prepareInputsFromMessage(messageInput: any): Record<string, any> {
    // If upstream already passes { message_data: {...} }
    if (messageInput?.message_data && typeof messageInput.message_data === 'object') {
      return { message_data: messageInput.message_data };
    }

    // If upstream passes a whole payload object that looks like message_data
    if (messageInput && typeof messageInput === 'object') {
      // Heuristic: treat as message_data if it contains any expected fields
      const looksLikeMessageData = (
        'input_text' in messageInput ||
        'input_type' in messageInput ||
        'metadata' in messageInput ||
        'audio_url' in messageInput ||
        'voice_file_id' in messageInput
      );
      if (looksLikeMessageData) {
        return { message_data: messageInput };
      }
    }

    // Fallbacks: string input → wrap into message_data
    if (typeof messageInput === 'string') {
      return { message_data: { input_text: messageInput, input_type: 'text' } };
    }

    // Last resort: wrap as-is
    return { message_data: messageInput };
  }

  /**
   * Validate that we have a message_data object
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);
    if (!inputs.message_data || typeof inputs.message_data !== 'object') {
      throw new Error("Switch node requires 'message_data' object input");
    }
  }

  /**
   * Persist inputs alongside outputs for inspector/UX
   */
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
