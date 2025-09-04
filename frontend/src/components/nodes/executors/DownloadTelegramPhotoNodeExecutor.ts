// DownloadTelegramPhotoNode Executor - Orchestrates Telegram photo download node
// Ensures inputs contain message_data with photo file info and normalizes outputs

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

export class DownloadTelegramPhotoNodeExecutor extends NodeExecutor {
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
   * Validate inputs for the download photo node
   * Accepts either:
   *  - inputs.message_data.photo_input.file_id (pre-download state)
   *  - inputs.message_data.photo_input as base64 data URI (already downloaded)
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    if (!inputs.message_data) {
      throw new Error('Download Telegram Photo node requires message_data input');
    }

    const md = inputs.message_data;

    // Photo info may be at message_data.photo_input
    const pi = md.photo_input;

    if (!pi) {
      throw new Error('Download Telegram Photo node expects photo_input within message_data');
    }

    // Handle Telegram photo structure: photo_input.best.file_id or direct file_id or base64 data
    const hasFileIdDirect = typeof pi === 'object' && !!pi.file_id;
    const hasFileIdInBest = typeof pi === 'object' && typeof pi.best === 'object' && !!pi.best?.file_id;
    const isBase64Data = typeof pi === 'string' && pi.startsWith('data:');

    if (!hasFileIdDirect && !hasFileIdInBest && !isBase64Data) {
      throw new Error('photo_input must include file_id (direct or in best photo) or base64 data URI (string)');
    }

    // Persist normalized inputs for inspector
    this.lastInputs = { message_data: md };
  }

  /**
   * Normalize outputs for UI/components
   * - If backend returns photo as raw/base64 under a different key, map to message_data.photo_input
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processed = await super.processExecutionResult(result);

    if (processed?.success && processed.outputs) {
      const out = processed.outputs;

      // Ensure outputs.message_data exists and carry forward incoming message_data if backend only returns photo
      if (!out.message_data) {
        out.message_data = {};
      }

      // If backend returned photo_data or data_uri, map to message_data.photo_input
      if (!out.message_data.photo_input) {
        if (typeof out.photo_data === 'string' && out.photo_data.startsWith('data:')) {
          out.message_data.photo_input = out.photo_data;
        } else if (typeof out.data_uri === 'string' && out.data_uri.startsWith('data:')) {
          out.message_data.photo_input = out.data_uri;
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
