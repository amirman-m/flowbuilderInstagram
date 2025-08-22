// ChatInputNode Executor - SOLID-compliant orchestration for ChatInput nodes
// Handles user input collection, execution, and UI updates for external orchestrators

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for ChatInput nodes
 * Handles user input processing and message data output formatting
 */
export class ChatInputNodeExecutor extends NodeExecutor {
  
  constructor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void
  ) {
    super(nodeId, instance, nodeType, onNodeUpdate);
  }

  /**
   * Execute ChatInput node with user message input
   * @param userInput - The user's message input (string)
   * @returns Execution result with message_data output
   */
  async executeWithUserInput(userInput: string, flowId: number): Promise<NodeExecutionResult> {
    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: {
        user_input: userInput.trim()
      }
    };

    return await this.execute(context);
  }

  /**
   * Validate ChatInput-specific inputs
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);
    
    if (!inputs.user_input || typeof inputs.user_input !== 'string') {
      throw new Error('ChatInput node requires user_input as string');
    }
    
    if (!inputs.user_input.trim()) {
      throw new Error('ChatInput node requires non-empty user_input');
    }
  }

  /**
   * Process ChatInput execution result
   * Ensures proper message_data output format
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processedResult = await super.processExecutionResult(result);
    
    // Ensure outputs contain message_data in expected format
    if (processedResult.success && processedResult.outputs) {
      // Normalize message_data output for downstream nodes
      if (!processedResult.outputs.message_data && processedResult.outputs.user_input) {
        processedResult.outputs.message_data = {
          input_text: processedResult.outputs.user_input,
          timestamp: new Date().toISOString(),
          word_count: processedResult.outputs.user_input.split(' ').length
        };
      }
    }
    
    return processedResult;
  }

  /**
   * Get the processed message data from last execution
   */
  getLastMessageData(): any {
    const lastExecution = this.instance?.data?.lastExecution;
    if (lastExecution?.outputs?.message_data) {
      return lastExecution.outputs.message_data;
    }
    return null;
  }

  /**
   * Get user input from last execution
   */
  getLastUserInput(): string | null {
    const messageData = this.getLastMessageData();
    if (messageData?.input_text) {
      return messageData.input_text;
    }
    
    const lastExecution = this.instance?.data?.lastExecution;
    if (lastExecution?.outputs?.user_input) {
      return lastExecution.outputs.user_input;
    }
    
    return null;
  }

  /**
   * Check if node has been executed with user input
   */
  hasExecutedInput(): boolean {
    return this.getLastUserInput() !== null;
  }

  /**
   * Get execution summary for display in orchestrator
   */
  getExecutionSummary(): { 
    hasInput: boolean; 
    inputText?: string; 
    wordCount?: number; 
    timestamp?: string;
  } {
    const lastInput = this.getLastUserInput();
    const messageData = this.getLastMessageData();
    
    if (!lastInput) {
      return { hasInput: false };
    }
    
    return {
      hasInput: true,
      inputText: lastInput,
      wordCount: messageData?.word_count || lastInput.split(' ').length,
      timestamp: messageData?.timestamp || new Date().toISOString()
    };
  }
}
