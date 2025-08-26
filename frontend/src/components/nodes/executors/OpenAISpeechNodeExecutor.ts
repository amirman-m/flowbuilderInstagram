import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * OpenAI Speech (TTS) Node Executor
 * - Builds inputs from raw text or upstream message payloads
 * - Validates required settings (model, voice)
 * - Normalizes outputs to expose `voice_output` (data URI string)
 */
export class OpenAISpeechNodeExecutor extends NodeExecutor {
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
   * Execute using a plain text string as input
   */
  async executeWithText(text: string, flowId: number): Promise<NodeExecutionResult> {
    const inputs = { input_text: String(text ?? '') };
    this.lastInputs = inputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs,
    };

    return await this.execute(context);
  }

  /**
   * Execute using an upstream message-like payload (e.g., ChatInput or LLM output)
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
   * Prepare inputs from various upstream shapes to pick a reasonable text string
   */
  private prepareInputsFromUpstream(upstream: any): Record<string, any> {
    // If upstream includes explicit input_text, prefer it
    if (upstream && typeof upstream === 'object' && typeof upstream.input_text === 'string') {
      return { input_text: upstream.input_text };
    }

    // If upstream has ai_response, prefer that
    if (upstream && typeof upstream === 'object' && typeof upstream.ai_response === 'string') {
      return { input_text: upstream.ai_response };
    }

    // If upstream has message_data with input_text
    if (
      upstream &&
      typeof upstream === 'object' &&
      upstream.message_data &&
      typeof upstream.message_data === 'object'
    ) {
      const md = upstream.message_data;
      if (typeof md.input_text === 'string' && md.input_text.trim()) {
        return { input_text: md.input_text.trim() };
      }
      if (typeof md.ai_response === 'string' && md.ai_response.trim()) {
        return { input_text: md.ai_response.trim() };
      }
      // Fallback: first string value in message_data
      for (const v of Object.values(md)) {
        if (typeof v === 'string' && v.trim()) {
          return { input_text: v.trim() };
        }
      }
    }

    // Generic object: scan for likely string fields
    if (upstream && typeof upstream === 'object') {
      for (const [k, v] of Object.entries(upstream)) {
        if (typeof v === 'string' && v.trim()) {
          return { input_text: v.trim() };
        }
        if (v && typeof v === 'object') {
          // nested ai_response or input_text
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vv: any = v;
          if (typeof vv.ai_response === 'string' && vv.ai_response.trim()) {
            return { input_text: vv.ai_response.trim() };
          }
          if (typeof vv.input_text === 'string' && vv.input_text.trim()) {
            return { input_text: vv.input_text.trim() };
          }
          for (const nested of Object.values(vv)) {
            if (typeof nested === 'string' && nested.trim()) {
              return { input_text: nested.trim() };
            }
          }
        }
      }
    }

    // If a plain string
    if (typeof upstream === 'string' && upstream.trim()) {
      return { input_text: upstream.trim() };
    }

    // Default empty
    return { input_text: '' };
  }

  /**
   * Validate that we have a non-empty text input and required settings
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    // Ensure there is some text to synthesize
    const text = this.extractTextFromInputs(inputs);
    if (!text) {
      throw new Error('OpenAI Speech node requires text input. Connect a node that outputs text or map it to the input_text port.');
    }

    // Ensure required settings
    const settings = this.getCurrentSettings();
    if (!settings.voice) {
      throw new Error('OpenAI Speech node is not configured: please select a Voice in Settings.');
    }
    if (!settings.model) {
      throw new Error('OpenAI Speech node is not configured: please select a Model (e.g., tts-1).');
    }
  }

  /**
   * Extract a usable string from various input shapes
   */
  private extractTextFromInputs(inputs: Record<string, any>): string | null {
    if (typeof inputs.input_text === 'string' && inputs.input_text.trim()) {
      return inputs.input_text.trim();
    }

    for (const value of Object.values(inputs)) {
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (value && typeof value === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const o: any = value;
        if (typeof o.ai_response === 'string' && o.ai_response.trim()) return o.ai_response.trim();
        if (typeof o.input_text === 'string' && o.input_text.trim()) return o.input_text.trim();
        for (const v of Object.values(o)) {
          if (typeof v === 'string' && v.trim()) return v.trim();
        }
      }
    }
    return null;
  }

  /**
   * Normalize outputs to guarantee `voice_output` and attach metadata if present
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processed = await super.processExecutionResult(result);

    if (processed?.success && processed.outputs) {
      const out = processed.outputs;
      // Some backends might return response -> normalize to voice_output
      if (!out.voice_output && typeof out.response === 'string') {
        out.voice_output = out.response;
      }
      if (processed.metadata) {
        out.metadata = processed.metadata;
      }
    }

    return processed;
  }

  /**
   * Persist inputs and last execution for inspector
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
