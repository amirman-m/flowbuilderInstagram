// GeminiSpeechNode Executor - SOLID-compliant orchestration for Google Gemini speech synthesis nodes

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for Google Gemini Speech nodes
 * Handles text input processing and speech synthesis response normalization
 */
export class GeminiSpeechNodeExecutor extends NodeExecutor {
  // Store last prepared inputs for persistence/inspector
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
   * Execute Gemini Speech node with text input
   */
  async executeWithTextInput(textInput: any, flowId: number): Promise<NodeExecutionResult> {
    const preparedInputs = this.prepareInputsFromText(textInput);
    this.lastInputs = preparedInputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: preparedInputs
    };

    return await this.execute(context);
  }

  /**
   * Prepare inputs from text data
   */
  private prepareInputsFromText(textInput: any): Record<string, any> {
    let inputText = '';
    
    // Handle different text input formats
    if (typeof textInput === 'string') {
      inputText = textInput;
    } else if (textInput?.text) {
      inputText = textInput.text;
    } else if (textInput?.input_text) {
      inputText = textInput.input_text;
    } else if (textInput?.ai_response) {
      inputText = textInput.ai_response;
    } else if (textInput?.user_input) {
      inputText = textInput.user_input;
    } else if (textInput && typeof textInput === 'object') {
      // Fallback: stringify object
      inputText = JSON.stringify(textInput);
    }

    return {
      input_text: inputText
    };
  }

  /**
   * Validate inputs and required settings
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    if (!inputs.input_text) {
      throw new Error('Gemini Speech node requires input_text');
    }

    const settings = this.getCurrentSettings();
    if (!settings.model) {
      throw new Error('Gemini Speech node is not configured: please open Settings and select a Model. Tip: double-click the Gemini node to open its settings.');
    }
    if (!settings.voice) {
      throw new Error('Gemini Speech node is not configured: please open Settings and select a Voice. Tip: double-click the Gemini node to open its settings.');
    }
  }

  /**
   * Normalize execution result to have voice_output
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processedResult = await super.processExecutionResult(result);

    if (processedResult.success && processedResult.outputs) {
      // Normalize Gemini outputs to a common key for UI/components
      if (!processedResult.outputs.voice_output && processedResult.outputs.audio) {
        processedResult.outputs.voice_output = processedResult.outputs.audio;
      }

      if (processedResult.metadata) {
        processedResult.outputs.metadata = processedResult.metadata;
      }
    }

    return processedResult;
  }

  /**
   * Extract last generated audio for summaries
   */
  getLastGeneratedAudio(): string | null {
    const lastExecution = this.instance?.data?.lastExecution;
    if (lastExecution?.outputs?.voice_output) {
      return lastExecution.outputs.voice_output;
    }
    if (lastExecution?.outputs?.audio) {
      return lastExecution.outputs.audio;
    }
    return null;
  }

  /**
   * Convenience: get current model and settings
   */
  getCurrentModel(): string {
    const settings = this.getCurrentSettings();
    return settings.model || '';
  }

  getCurrentVoice(): string {
    const settings = this.getCurrentSettings();
    return settings.voice || '';
  }

  getCurrentSpeed(): number {
    const settings = this.getCurrentSettings();
    return settings.speed || 1.0;
  }

  getCurrentFormat(): string {
    const settings = this.getCurrentSettings();
    return settings.response_format || 'mp3';
  }

  isConfigured(): boolean {
    const settings = this.getCurrentSettings();
    return !!settings.model && !!settings.voice;
  }

  /**
   * Provide a summary for orchestrators/inspector panels
   */
  getExecutionSummary(): {
    hasAudio: boolean;
    model?: string;
    voice?: string;
    speed?: number;
    format?: string;
    timestamp?: string;
  } {
    const lastAudio = this.getLastGeneratedAudio();
    const lastExecution = this.instance?.data?.lastExecution;
    const settings = this.getCurrentSettings();

    if (!lastAudio) {
      return { hasAudio: false };
    }

    return {
      hasAudio: true,
      model: settings.model,
      voice: settings.voice,
      speed: settings.speed || 1.0,
      format: settings.response_format || 'mp3',
      timestamp: lastExecution?.startedAt || new Date().toISOString()
    };
  }

  /**
   * Persist inputs alongside outputs so inspector/data tab shows fresh input
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
