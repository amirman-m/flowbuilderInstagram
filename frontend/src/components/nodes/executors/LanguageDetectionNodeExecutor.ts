// LanguageDetectionNode Executor - orchestrates execution for multilingual-e5-language-detection

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for Language Detection node
 * - Builds inputs from upstream message payloads
 * - Validates presence of text
 * - Normalizes outputs to ensure detected_language and message_data are present
 */
export class LanguageDetectionNodeExecutor extends NodeExecutor {
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
   * Execute using an upstream message-like payload (ChatInput/LLM/etc.)
   */
  async executeWithMessageInput(messageInput: any, flowId: number): Promise<NodeExecutionResult> {
    const inputs = this.prepareInputsFromUpstream(messageInput);
    this.lastInputs = inputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs,
    };

    return await this.execute(context);
  }

  /**
   * Prepare inputs: prefer message_data.ai_response -> message_data.input_text -> any string
   */
  private prepareInputsFromUpstream(upstream: any): Record<string, any> {
    // Preserve full message_data if provided
    if (upstream && typeof upstream === 'object' && upstream.message_data) {
      const md = upstream.message_data;
      if (md && typeof md === 'object') {
        return { message_data: md };
      }
      // Primitive message_data -> wrap
      return { message_data: { input_text: String(md) } };
    }

    // If upstream already has ai_response or input_text at top-level
    if (upstream && typeof upstream === 'object') {
      if (typeof upstream.ai_response === 'string' && upstream.ai_response.trim()) {
        return { message_data: { ai_response: upstream.ai_response.trim() } };
      }
      if (typeof upstream.input_text === 'string' && upstream.input_text.trim()) {
        return { message_data: { input_text: upstream.input_text.trim() } };
      }
    }

    // If a plain string
    if (typeof upstream === 'string' && upstream.trim()) {
      return { message_data: { input_text: upstream.trim(), input_type: 'string' } };
    }

    // Default empty
    return { message_data: { input_text: '' } };
  }

  /**
   * Validate that some text exists to detect language from
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    const text = this.extractText(inputs);
    if (!text) {
      throw new Error('Language Detection node requires text input. Connect a node that outputs text to the message_data port.');
    }
  }

  /**
   * Extract text from inputs similar to backend priority
   */
  private extractText(inputs: Record<string, any>): string | null {
    if (!inputs) return null;

    // Check dict-like payloads
    for (const value of Object.values(inputs)) {
      if (value && typeof value === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const o: any = value;
        if (typeof o.ai_response === 'string' && o.ai_response.trim()) return o.ai_response.trim();
        if (typeof o.input_text === 'string' && o.input_text.trim()) return o.input_text.trim();
      }
    }

    // Then any raw string
    for (const value of Object.values(inputs)) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return null;
  }

  /**
   * Normalize outputs to ensure we expose detected_language and preserve message_data
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processed = await super.processExecutionResult(result);

    if (processed?.success && processed.outputs) {
      const out = processed.outputs;
      // Ensure detected_language is a string at top-level
      if (typeof out.detected_language !== 'string' && out.message_data && typeof out.message_data.detected_language === 'string') {
        out.detected_language = out.message_data.detected_language;
      }
    }

    return processed;
  }

  /**
   * Persist inputs and last execution for inspector panels
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
