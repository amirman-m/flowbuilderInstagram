// OpenAIImageDescriptionNode Executor - SOLID-compliant orchestration for OpenAI image description nodes

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for OpenAI Image Description nodes
 * Handles image input processing and description response normalization
 */
export class OpenAIImageDescriptionNodeExecutor extends NodeExecutor {
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
   * Execute OpenAI Image Description node with image and optional text input
   */
  async executeWithImageInput(imageInput: any, textInput?: any, flowId?: number): Promise<NodeExecutionResult> {
    const preparedInputs = this.prepareInputsFromImageData(imageInput, textInput);
    this.lastInputs = preparedInputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId: flowId || 0,
      inputs: preparedInputs
    };

    return await this.execute(context);
  }

  /**
   * Execute with message data (for flow-based execution)
   */
  async executeWithMessageData(messageData: any, flowId: number): Promise<NodeExecutionResult> {
    // Extract image and text from message data
    let imageInput = null;
    let textInput = null;

    if (messageData?.photo_input) {
      imageInput = messageData.photo_input;
    }
    if (messageData?.input_text || messageData?.ai_response) {
      textInput = messageData.input_text || messageData.ai_response;
    }

    return await this.executeWithImageInput(imageInput, textInput, flowId);
  }

  /**
   * Prepare inputs from image and optional text data
   */
  private prepareInputsFromImageData(imageInput: any, textInput?: any): Record<string, any> {
    const inputs: Record<string, any> = {};

    // Handle image input (required)
    if (imageInput) {
      inputs.photo = imageInput;
    }

    // Handle optional text input
    if (textInput) {
      if (typeof textInput === 'string') {
        inputs.text_input = textInput;
      } else if (textInput && typeof textInput === 'object') {
        // Extract text from various object formats
        if (textInput.ai_response) {
          inputs.text_input = textInput.ai_response;
        } else if (textInput.input_text) {
          inputs.text_input = textInput.input_text;
        } else if (textInput.text) {
          inputs.text_input = textInput.text;
        } else {
          inputs.text_input = JSON.stringify(textInput);
        }
      }
    }

    return inputs;
  }

  /**
   * Validate inputs and required settings
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    // Check for image input (required)
    if (!inputs.photo) {
      throw new Error('Image input required. Please connect an image source (e.g., Telegram Photo Downloader).');
    }

    // Validate image format
    const photo = inputs.photo;
    const isValidImage = this.isValidImageInput(photo);
    if (!isValidImage) {
      throw new Error('Invalid image format. Expected base64 data URI or valid image data.');
    }

    // Check settings
    const settings = this.getCurrentSettings();
    if (!settings.model) {
      throw new Error('Vision model not configured. Please open Settings and select a model (e.g., gpt-4o).');
    }

    // Validate model supports vision
    const model = settings.model;
    const visionModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4-vision-preview'];
    if (!visionModels.includes(model)) {
      throw new Error(`Model "${model}" does not support vision. Please select a vision-capable model like gpt-4o.`);
    }
  }

  /**
   * Check if input is valid image data
   */
  private isValidImageInput(photo: any): boolean {
    if (typeof photo === 'string') {
      // Check for data URI format
      if (photo.startsWith('data:image/') && photo.includes('base64,')) {
        return true;
      }
      // Check for plain base64 (should be long and contain valid base64 chars)
      if (photo.length > 100 && /^[A-Za-z0-9+/=]+$/.test(photo)) {
        return true;
      }
    } else if (photo && typeof photo === 'object') {
      // Check for message_data format with photo_input
      if (photo.photo_input) {
        return this.isValidImageInput(photo.photo_input);
      }
      // Check for other object formats
      if (photo.image || photo.data || photo.base64) {
        return true;
      }
    }
    return false;
  }

  /**
   * Normalize execution result to have ai_response and carry metadata
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processedResult = await super.processExecutionResult(result);

    if (processedResult.success && processedResult.outputs) {
      // Normalize outputs to ensure ai_response is available
      if (!processedResult.outputs.ai_response && processedResult.outputs.description) {
        processedResult.outputs.ai_response = processedResult.outputs.description;
      }

      // Preserve metadata from backend
      if (processedResult.metadata) {
        processedResult.outputs.metadata = processedResult.metadata;
      }
    }

    return processedResult;
  }

  /**
   * Extract last image description (plain text) for summaries
   */
  getLastImageDescription(): string | null {
    const lastExecution = this.instance?.data?.lastExecution;
    if (lastExecution?.outputs?.ai_response) {
      return this.extractPlainTextResponse(lastExecution.outputs.ai_response);
    }
    if (lastExecution?.outputs?.description) {
      return this.extractPlainTextResponse(lastExecution.outputs.description);
    }
    return null;
  }

  /**
   * Convert complex response payloads to plain text, stripping formatting
   */
  private extractPlainTextResponse(response: any): string {
    let text = '';

    if (typeof response === 'string') {
      text = response;
    } else if (response && typeof response === 'object') {
      if (typeof response.ai_response === 'string') {
        text = response.ai_response;
      } else if (typeof response.aiResponse === 'string') {
        text = response.aiResponse;
      } else if (typeof response.description === 'string') {
        text = response.description;
      } else {
        try {
          text = JSON.stringify(response);
        } catch {
          text = String(response);
        }
      }
    } else if (response != null) {
      text = String(response);
    }

    // Strip HTML and basic markdown
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/[*_`>#-]+/g, ' ');

    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Convenience: get current model and settings
   */
  getCurrentModel(): string {
    const settings = this.getCurrentSettings();
    return settings.model || 'gpt-4o';
  }

  getCurrentSystemPrompt(): string {
    const settings = this.getCurrentSettings();
    return settings.system_prompt || '';
  }

  getCurrentDetailLevel(): string {
    const settings = this.getCurrentSettings();
    return settings.detail_level || 'high';
  }

  isConfigured(): boolean {
    const settings = this.getCurrentSettings();
    return !!settings.model;
  }

  /**
   * Provide a summary for orchestrators/inspector panels
   */
  getExecutionSummary(): {
    hasDescription: boolean;
    descriptionText?: string;
    model?: string;
    detailLevel?: string;
    hasAdditionalContext?: boolean;
    responseLength?: number;
    timestamp?: string;
  } {
    const lastDescription = this.getLastImageDescription();
    const lastExecution = this.instance?.data?.lastExecution;
    const settings = this.getCurrentSettings();

    if (!lastDescription) {
      return { hasDescription: false };
    }

    const hasAdditionalContext = !!(this.lastInputs?.text_input);

    return {
      hasDescription: true,
      descriptionText: lastDescription,
      model: settings.model,
      detailLevel: settings.detail_level || 'high',
      hasAdditionalContext,
      responseLength: lastDescription.length,
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
