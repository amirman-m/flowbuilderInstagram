// GeminiImageDescriptionNode Executor - SOLID-compliant orchestration for Google Gemini image description nodes

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for Google Gemini Image Description nodes
 * Handles image input processing and description response normalization
 */
export class GeminiImageDescriptionNodeExecutor extends NodeExecutor {
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
   * Execute Gemini Image Description node with image input
   */
  async executeWithImageInput(imageInput: any, flowId: number): Promise<NodeExecutionResult> {
    const preparedInputs = this.prepareInputsFromImage(imageInput);
    this.lastInputs = preparedInputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: preparedInputs
    };

    return await this.execute(context);
  }

  /**
   * Prepare inputs from image data
   */
  private prepareInputsFromImage(imageInput: any): Record<string, any> {
    let imageData = '';
    
    // Handle different image input formats
    if (typeof imageInput === 'string') {
      imageData = imageInput;
    } else if (imageInput?.image_data) {
      imageData = imageInput.image_data;
    } else if (imageInput?.image) {
      imageData = imageInput.image;
    } else if (imageInput && typeof imageInput === 'object') {
      // Try to find base64 image data in the object
      const possibleKeys = ['base64', 'data', 'content', 'file_data'];
      for (const key of possibleKeys) {
        if (imageInput[key] && typeof imageInput[key] === 'string') {
          imageData = imageInput[key];
          break;
        }
      }
      
      if (!imageData) {
        imageData = JSON.stringify(imageInput);
      }
    }

    return {
      image_data: imageData
    };
  }

  /**
   * Validate inputs and required settings
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    if (!inputs.image_data) {
      throw new Error('Gemini Image Description node requires image_data input');
    }

    const settings = this.getCurrentSettings();
    if (!settings.model) {
      throw new Error('Gemini Image Description node is not configured: please open Settings and select a Model (e.g., gemini-1.5-flash). Tip: double-click the Gemini node to open its settings.');
    }
  }

  /**
   * Normalize execution result to have ai_response
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processedResult = await super.processExecutionResult(result);

    if (processedResult.success && processedResult.outputs) {
      // Normalize Gemini outputs to a common key for UI/components
      if (!processedResult.outputs.ai_response && processedResult.outputs.description) {
        processedResult.outputs.ai_response = processedResult.outputs.description;
      }

      if (processedResult.metadata) {
        processedResult.outputs.metadata = processedResult.metadata;
      }
    }

    return processedResult;
  }

  /**
   * Extract last AI response (description text) for summaries
   */
  getLastDescription(): string | null {
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
   * Convert complex response payloads to plain text
   */
  private extractPlainTextResponse(response: any): string {
    let text = '';

    if (typeof response === 'string') {
      text = response;
    } else if (response && typeof response === 'object') {
      if (typeof response.description === 'string') {
        text = response.description;
      } else if (typeof response.ai_response === 'string') {
        text = response.ai_response;
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

    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Convenience: get current model
   */
  getCurrentModel(): string {
    const settings = this.getCurrentSettings();
    return settings.model || '';
  }

  isConfigured(): boolean {
    const settings = this.getCurrentSettings();
    return !!settings.model;
  }

  /**
   * Provide a summary for orchestrators/inspector panels
   */
  getExecutionSummary(): {
    hasResponse: boolean;
    responseText?: string;
    model?: string;
    timestamp?: string;
  } {
    const lastResponse = this.getLastDescription();
    const lastExecution = this.instance?.data?.lastExecution;
    const settings = this.getCurrentSettings();

    if (!lastResponse) {
      return { hasResponse: false };
    }

    return {
      hasResponse: true,
      responseText: lastResponse,
      model: settings.model,
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
