// DeepSeekChatNode Executor - SOLID-compliant orchestration for DeepSeek AI nodes
// Handles AI input processing, execution, and response formatting for external orchestrators

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for DeepSeek Chat nodes
 * Handles AI input processing and response generation
 */
export class DeepSeekChatNodeExecutor extends NodeExecutor {
  
  constructor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void
  ) {
    super(nodeId, instance, nodeType, onNodeUpdate);
  }

  /**
   * Execute DeepSeek node with message input from previous node
   * @param messageInput - Input from ChatInput or other nodes
   * @returns Execution result with AI response
   */
  async executeWithMessageInput(messageInput: any, flowId: number): Promise<NodeExecutionResult> {
    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: this.prepareInputsFromMessage(messageInput)
    };

    return await this.execute(context);
  }

  /**
   * Prepare inputs from message data (from ChatInput or other nodes)
   */
  private prepareInputsFromMessage(messageInput: any): Record<string, any> {
    let inputText = '';
    
    // Handle different input formats
    if (typeof messageInput === 'string') {
      inputText = messageInput;
    } else if (messageInput?.message_data?.input_text) {
      inputText = messageInput.message_data.input_text;
    } else if (messageInput?.input_text) {
      inputText = messageInput.input_text;
    } else if (messageInput?.user_input) {
      inputText = messageInput.user_input;
    } else if (messageInput && typeof messageInput === 'object') {
      // Try to extract text from object
      inputText = JSON.stringify(messageInput);
    }

    return {
      message_data: inputText,
      user_input: inputText
    };
  }

  /**
   * Validate DeepSeek-specific inputs and settings
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);
    
    // Check if we have some form of text input
    if (!inputs.message_data && !inputs.user_input) {
      throw new Error('DeepSeek node requires message_data or user_input');
    }

    // Validate required settings
    const settings = this.getCurrentSettings();
    if (!settings.model) {
      throw new Error('DeepSeek node requires model configuration');
    }
  }

  /**
   * Process DeepSeek execution result
   * Ensures proper AI response output format
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processedResult = await super.processExecutionResult(result);
    
    // Ensure outputs contain ai_response in expected format
    if (processedResult.success && processedResult.outputs) {
      // Normalize AI response output for downstream nodes
      if (!processedResult.outputs.ai_response && processedResult.outputs.response) {
        processedResult.outputs.ai_response = processedResult.outputs.response;
      }
      
      // Add metadata if available
      if (processedResult.metadata) {
        processedResult.outputs.metadata = processedResult.metadata;
      }
    }
    
    return processedResult;
  }

  /**
   * Get the AI response from last execution
   */
  getLastAIResponse(): string | null {
    const lastExecution = this.instance?.data?.lastExecution;
    if (lastExecution?.outputs?.ai_response) {
      return this.extractPlainTextResponse(lastExecution.outputs.ai_response);
    }
    if (lastExecution?.outputs?.response) {
      return this.extractPlainTextResponse(lastExecution.outputs.response);
    }
    return null;
  }

  /**
   * Extract plain text from AI response, removing formatting
   */
  private extractPlainTextResponse(response: any): string {
    let text = '';
    
    if (typeof response === 'string') {
      text = response;
    } else if (response && typeof response === 'object') {
      if (typeof response.aiResponse === 'string') {
        text = response.aiResponse;
      } else if (typeof response.ai_response === 'string') {
        text = response.ai_response;
      } else {
        text = JSON.stringify(response);
      }
    } else if (response != null) {
      text = String(response);
    }
    
    // Strip HTML tags and basic markdown
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/[*_`>#-]+/g, ' ');
    
    // Collapse whitespace
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Get current model configuration
   */
  getCurrentModel(): string {
    const settings = this.getCurrentSettings();
    return settings.model || '';
  }

  /**
   * Get current system prompt
   */
  getCurrentSystemPrompt(): string {
    const settings = this.getCurrentSettings();
    return settings.system_prompt || '';
  }

  /**
   * Check if node is properly configured
   */
  isConfigured(): boolean {
    const settings = this.getCurrentSettings();
    return !!(settings.model);
  }

  /**
   * Get execution summary for display in orchestrator
   */
  getExecutionSummary(): {
    hasResponse: boolean;
    responseText?: string;
    model?: string;
    inputLength?: number;
    responseLength?: number;
    timestamp?: string;
  } {
    const lastResponse = this.getLastAIResponse();
    const lastExecution = this.instance?.data?.lastExecution;
    const settings = this.getCurrentSettings();
    
    if (!lastResponse) {
      return { hasResponse: false };
    }

    // Try to get input length from execution data
    let inputLength = 0;
    if (lastExecution?.outputs?.message_data) {
      inputLength = String(lastExecution.outputs.message_data).length;
    }

    return {
      hasResponse: true,
      responseText: lastResponse,
      model: settings.model,
      inputLength,
      responseLength: lastResponse.length,
      timestamp: lastExecution?.startedAt || new Date().toISOString()
    };
  }

  /**
   * Get configuration summary for orchestrator display
   */
  getConfigurationSummary(): {
    model: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    isConfigured: boolean;
  } {
    const settings = this.getCurrentSettings();
    
    return {
      model: settings.model || 'Not configured',
      systemPrompt: settings.system_prompt,
      temperature: settings.temperature,
      maxTokens: settings.max_tokens,
      isConfigured: this.isConfigured()
    };
  }
}
