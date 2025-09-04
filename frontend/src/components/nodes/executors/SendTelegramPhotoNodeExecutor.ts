import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * SendTelegramPhotoNodeExecutor - Handles execution of Telegram Send Photo action nodes
 * Validates inputs for photo and optional caption, orchestrates backend execution
 */
export class SendTelegramPhotoNodeExecutor extends NodeExecutor {

  constructor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void
  ) {
    super(nodeId, instance, nodeType, onNodeUpdate);
  }
  
  /**
   * Execute with message data (for flow-based execution)
   */
  async executeWithMessageData(messageData: any, flowId: number): Promise<NodeExecutionResult> {
    const inputs = { message_data: messageData };
    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs,
    };
    return await this.execute(context);
  }

  /**
   * Execute with dual inputs (photo and caption)
   */
  async executeWithInputs(photoInput: any, captionInput?: any, flowId?: number): Promise<NodeExecutionResult> {
    const inputs: any = { photo: photoInput };
    if (captionInput !== undefined) {
      inputs.caption = captionInput;
    }
    
    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId: flowId || 0,
      inputs,
    };
    return await this.execute(context);
  }

  /**
   * Validate inputs before execution
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    // Photo input is required
    const photoInput = inputs.photo;
    if (!photoInput) {
      throw new Error('Send Telegram Photo node requires photo input');
    }

    // Photo can be a string (data URI) or object with photo data
    const isStringPhoto = typeof photoInput === 'string' && photoInput.trim();
    const isObjectPhoto = typeof photoInput === 'object' && (
      photoInput.photo_input || 
      photoInput.photo || 
      photoInput.image || 
      photoInput.data_uri ||
      (photoInput.message_data && photoInput.message_data.photo_input)
    );

    if (!isStringPhoto && !isObjectPhoto) {
      throw new Error('Photo input must contain image data (data URI string or object with photo data)');
    }

    // Caption is optional - can be string or object with text content
    const captionInput = inputs.caption;
    if (captionInput !== undefined) {
      const isStringCaption = typeof captionInput === 'string';
      const isObjectCaption = typeof captionInput === 'object' && (
        captionInput.input_text || 
        captionInput.chat_input || 
        captionInput.ai_response ||
        captionInput.text ||
        captionInput.caption ||
        captionInput.message
      );

      if (!isStringCaption && !isObjectCaption) {
        throw new Error('Caption input must be text (string or object with text content)');
      }
    }

    // Input validation complete
  }

  /**
   * Normalize outputs for UI/components
   * - Ensure telegram_result is available for display
   */
  protected normalizeOutputs(outputs: any): any {
    if (!outputs || typeof outputs !== 'object') {
      return outputs;
    }

    // The backend should return telegram_result with success info
    // No additional normalization needed for send photo action
    return outputs;
  }

  /**
   * Update node state after execution
   */
  protected async updateNodeState(result: any): Promise<void> {
    if (this.onNodeUpdate) {
      const nodeUpdate = {
        data: {
          ...this.instance.data,
          lastExecution: {
            ...result,
            timestamp: new Date().toISOString(),
          },
        },
      };
      this.onNodeUpdate(this.nodeId, nodeUpdate);
    }
  }
}
