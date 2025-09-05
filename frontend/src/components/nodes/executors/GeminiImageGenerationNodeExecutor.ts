// GeminiImageGenerationNode Executor - SOLID-compliant orchestration for Google Gemini image generation nodes

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for Google Gemini Image Generation nodes
 * Handles text prompt input processing and image generation response normalization
 */
export class GeminiImageGenerationNodeExecutor extends NodeExecutor {
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
   * Execute Gemini Image Generation node with text prompt input
   */
  async executeWithPromptInput(promptInput: any, flowId: number): Promise<NodeExecutionResult> {
    const preparedInputs = this.prepareInputsFromPrompt(promptInput);
    this.lastInputs = preparedInputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: preparedInputs
    };

    return await this.execute(context);
  }

  /**
   * Prepare inputs from text prompt data
   */
  private prepareInputsFromPrompt(promptInput: any): Record<string, any> {
    let promptText = '';
    
    // Handle different prompt input formats
    if (typeof promptInput === 'string') {
      promptText = promptInput;
    } else if (promptInput?.prompt) {
      promptText = promptInput.prompt;
    } else if (promptInput?.text) {
      promptText = promptInput.text;
    } else if (promptInput?.user_input) {
      promptText = promptInput.user_input;
    } else if (promptInput?.ai_response) {
      promptText = promptInput.ai_response;
    } else if (promptInput && typeof promptInput === 'object') {
      // Fallback: stringify object
      promptText = JSON.stringify(promptInput);
    }

    return {
      prompt: promptText
    };
  }

  /**
   * Validate inputs and required settings
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    if (!inputs.prompt) {
      throw new Error('Gemini Image Generation node requires prompt input');
    }

    const settings = this.getCurrentSettings();
    if (!settings.model) {
      throw new Error('Gemini Image Generation node is not configured: please open Settings and select a Model (e.g., gemini-1.5-flash). Tip: double-click the Gemini node to open its settings.');
    }
  }

  /**
   * Normalize execution result to have generated_image
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processedResult = await super.processExecutionResult(result);

    if (processedResult.success && processedResult.outputs) {
      // Normalize Gemini outputs to a common key for UI/components
      if (!processedResult.outputs.generated_image && processedResult.outputs.image) {
        processedResult.outputs.generated_image = processedResult.outputs.image;
      }

      if (processedResult.metadata) {
        processedResult.outputs.metadata = processedResult.metadata;
      }
    }

    return processedResult;
  }

  /**
   * Extract last generated image for summaries
   */
  getLastGeneratedImage(): string | null {
    const lastExecution = this.instance?.data?.lastExecution;
    if (lastExecution?.outputs?.generated_image) {
      return lastExecution.outputs.generated_image;
    }
    if (lastExecution?.outputs?.image) {
      return lastExecution.outputs.image;
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

  getCurrentSize(): string {
    const settings = this.getCurrentSettings();
    return settings.size || '1024x1024';
  }

  getCurrentQuality(): string {
    const settings = this.getCurrentSettings();
    return settings.quality || 'standard';
  }

  isConfigured(): boolean {
    const settings = this.getCurrentSettings();
    return !!settings.model;
  }

  /**
   * Provide a summary for orchestrators/inspector panels
   */
  getExecutionSummary(): {
    hasImage: boolean;
    model?: string;
    size?: string;
    quality?: string;
    timestamp?: string;
  } {
    const lastImage = this.getLastGeneratedImage();
    const lastExecution = this.instance?.data?.lastExecution;
    const settings = this.getCurrentSettings();

    if (!lastImage) {
      return { hasImage: false };
    }

    return {
      hasImage: true,
      model: settings.model,
      size: settings.size || '1024x1024',
      quality: settings.quality || 'standard',
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
