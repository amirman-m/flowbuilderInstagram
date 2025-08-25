// DownloadTelegramVoiceNode Executor - Orchestrates Telegram voice download node
// Ensures inputs contain message_data with voice file info and normalizes outputs

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

export class DownloadTelegramVoiceNodeExecutor extends NodeExecutor {
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
   * Execute with message_data from upstream Telegram input node
   */
  async executeWithMessageData(messageData: any, flowId: number): Promise<NodeExecutionResult> {
    const inputs = { message_data: messageData };
    this.lastInputs = inputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs,
    };

    return await this.execute(context);
  }

  /**
   * Validate inputs for the download voice node
   * Accepts either:
   *  - inputs.message_data.voice_input.file_id (pre-download state)
   *  - inputs.message_data.voice_input as base64 data URI (already downloaded)
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    if (!inputs.message_data) {
      throw new Error('Download Telegram Voice node requires message_data input');
    }

    const md = inputs.message_data;

    // Voice info may be at message_data.voice_input
    const vi = md.voice_input;

    if (!vi) {
      throw new Error('Download Telegram Voice node expects voice_input within message_data');
    }

    const hasFileId = typeof vi === 'object' && !!vi.file_id;
    const isBase64Data = typeof vi === 'string' && vi.startsWith('data:');

    if (!hasFileId && !isBase64Data) {
      throw new Error('voice_input must include file_id (object) or base64 data URI (string)');
    }

    // Persist normalized inputs for inspector
    this.lastInputs = { message_data: md };
  }

  /**
   * Normalize outputs for UI/components
   * - If backend returns voice as raw/base64 under a different key, map to message_data.voice_input
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processed = await super.processExecutionResult(result);

    if (processed?.success && processed.outputs) {
      const out = processed.outputs;

      // Ensure outputs.message_data exists and carry forward incoming message_data if backend only returns voice
      if (!out.message_data) {
        out.message_data = {};
      }

      // If backend returned voice_data or data_uri, map to message_data.voice_input
      if (!out.message_data.voice_input) {
        if (typeof out.voice_data === 'string' && out.voice_data.startsWith('data:')) {
          out.message_data.voice_input = out.voice_data;
        } else if (typeof out.data_uri === 'string' && out.data_uri.startsWith('data:')) {
          out.message_data.voice_input = out.data_uri;
        }
      }

      // Attach metadata passthrough if present
      if (processed.metadata) {
        out.metadata = processed.metadata;
        if (out.message_data && !out.message_data.metadata) {
          out.message_data.metadata = processed.metadata;
        }
      }
    }

    return processed;
  }

  /**
   * Persist last inputs and execution results
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
          ...(this.lastInputs || {}),
        },
        lastExecution: {
          status: result.status,
          outputs: result.outputs || {},
          startedAt: nowIso,
          completedAt: nowIso,
          executionTime: result.executionTime,
        },
        outputs: result.outputs || {},
      },
      updatedAt: new Date(),
    });
  }
}
