// LanguageTranslatorNode Executor - orchestrates execution for language-translator-m2m100

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for Language Translator (M2M100) node
 * - Builds inputs from upstream message payloads
 * - Validates presence of text and required target_language setting
 * - Normalizes outputs so UI can consistently read translated/original text and metadata
 */
export class LanguageTranslatorNodeExecutor extends NodeExecutor {
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
   * Prepare inputs: prefer rich message_data if provided, else wrap text
   */
  private prepareInputsFromUpstream(upstream: any): Record<string, any> {
    // Preserve full message_data if provided
    if (upstream && typeof upstream === 'object' && upstream.message_data) {
      const md = upstream.message_data;
      if (md && typeof md === 'object') {
        return { message_data: md };
      }
      return { message_data: { input_text: String(md) } };
    }

    // If upstream object with common keys
    if (upstream && typeof upstream === 'object') {
      if (typeof upstream.ai_response === 'string' && upstream.ai_response.trim()) {
        return { message_data: { input_text: upstream.ai_response.trim(), input_type: 'string' } };
      }
      if (typeof upstream.input_text === 'string' && upstream.input_text.trim()) {
        return { message_data: { input_text: upstream.input_text.trim(), input_type: 'string' } };
      }
      // Fallback: stringify
      return { message_data: { input_text: JSON.stringify(upstream), input_type: 'json' } };
    }

    // Plain string
    if (typeof upstream === 'string' && upstream.trim()) {
      return { message_data: { input_text: upstream.trim(), input_type: 'string' } };
    }

    return { message_data: { input_text: '' } };
  }

  /**
   * Validate that text exists and target_language is configured
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    const text = this.extractText(inputs);
    if (!text) {
      throw new Error('Language Translator node requires text input in message_data.input_text.');
    }

    const settings = this.getCurrentSettings();
    if (!settings?.target_language) {
      throw new Error('Language Translator node requires target_language setting. Select a target language before execution.');
    }
  }

  private extractText(inputs: Record<string, any>): string | null {
    if (!inputs) return null;
    const md = inputs.message_data;
    if (md && typeof md === 'object') {
      const t = (md.input_text ?? md.ai_response ?? '').toString().trim();
      return t || null;
    }
    if (typeof md === 'string' && md.trim()) return md.trim();
    // any raw string in inputs
    for (const v of Object.values(inputs)) {
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  }

  /**
   * Normalize outputs to ensure UI fields are present
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processed = await super.processExecutionResult(result);

    if (processed?.success && processed.outputs) {
      const out = processed.outputs;
      // Ensure message_data exists
      if (!out.message_data) out.message_data = {};

      // Map common backend keys -> UI expected fields
      if (typeof out.translated_text === 'string' && !out.message_data.input_text) {
        out.message_data.input_text = out.translated_text;
      }
      if (typeof out.original_text === 'string' && !out.message_data.input_text_before_translation) {
        out.message_data.input_text_before_translation = out.original_text;
      }

      // If backend returned message_data directly, keep as source of truth
      if (result.outputs?.message_data && typeof result.outputs.message_data === 'object') {
        out.message_data = { ...out.message_data, ...result.outputs.message_data };
      }

      // Attach/normalize metadata.translation
      const settings = this.getCurrentSettings();
      const meta = processed.metadata || result.metadata || {};
      if (!out.message_data.metadata) out.message_data.metadata = {};
      if (!out.metadata) out.metadata = {};
      const translationMeta = {
        model: meta?.translation?.model || meta?.model || 'M2M100',
        source_language: meta?.translation?.source_language || out.message_data?.source_language || settings?.source_language || undefined,
        target_language: meta?.translation?.target_language || out.message_data?.target_language || settings?.target_language || undefined,
        source_text_length: meta?.translation?.source_text_length ?? (out.message_data?.input_text_before_translation ? String(out.message_data.input_text_before_translation).length : undefined),
        translated_text_length: meta?.translation?.translated_text_length ?? (out.message_data?.input_text ? String(out.message_data.input_text).length : undefined),
      } as Record<string, any>;
      out.metadata = { ...out.metadata, translation: translationMeta };
      out.message_data.metadata = { ...out.message_data.metadata, translation: translationMeta };
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
