import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * OpenAI Image Generation Node Executor
 * Handles execution orchestration for OpenAI image generation nodes
 */
export class OpenAIImageGenerationNodeExecutor extends NodeExecutor {

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

  async execute(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    try {
      // Validate inputs
      await this.validateInputs(context.inputs);

      // Execute the node
      const result = await this.executeNode(context);
      
      // Update node state with success
      await this.updateNodeState(result);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
      console.error(`OpenAI Image Generation execution failed for node ${this.nodeId}:`, error);
      
      const errorResult: NodeExecutionResult = {
        success: false,
        outputs: {},
        error: errorMessage,
        metadata: { executionType: 'openai_image_generation' }
      };

      // Update node state with error
      await this.updateNodeState(errorResult);
      
      return errorResult;
    }
  }

  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    // OpenAI Image Generation is flexible with inputs
    const settings = this.instance?.data?.settings || {};
    
    // Check if we have any prompt source
    const hasInputPrompt = Object.values(inputs).some(input => {
      if (typeof input === 'string' && input.trim()) return true;
      if (typeof input === 'object' && input !== null) {
        const obj = input as Record<string, any>;
        return ['ai_response', 'input_text', 'text', 'prompt'].some(key => 
          typeof obj[key] === 'string' && obj[key].trim()
        );
      }
      return false;
    });
    
    const hasSettingsPrompt = typeof settings.prompt === 'string' && settings.prompt.trim();
    
    if (!hasInputPrompt && !hasSettingsPrompt) {
      throw new Error('No prompt provided. Connect a text input or configure a prompt in node settings.');
    }
  }

  protected async updateNodeState(result: any): Promise<void> {
    if (this.onNodeUpdate) {
      const currentData = this.instance?.data || {};
      const updatedData = {
        ...currentData,
        lastExecution: {
          ...currentData.lastExecution,
          status: result.success ? 'success' : 'error',
          error: result.error,
          timestamp: new Date().toISOString()
        }
      };

      this.onNodeUpdate(this.nodeId, {
        ...this.instance,
        data: updatedData
      });
    }
  }
}
