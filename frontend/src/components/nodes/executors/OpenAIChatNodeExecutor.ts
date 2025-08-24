// OpenAIChatNode Executor - SOLID-compliant orchestration for OpenAI chat nodes


import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for OpenAI Chat nodes
 * Handles AI input processing and response normalization
 */
export class OpenAIChatNodeExecutor extends NodeExecutor {
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
   * Execute OpenAI node with message input (from ChatInput or other nodes)
   */
  async executeWithMessageInput(messageInput: any, flowId: number): Promise<NodeExecutionResult> {
    const preparedInputs = this.prepareInputsFromMessage(messageInput);
    this.lastInputs = preparedInputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: preparedInputs
    };

    return await this.execute(context);
  }

  /**
   * Prepare inputs from message data (compatible with ChatInput output)
   */
  private prepareInputsFromMessage(messageInput: any): Record<string, any> {
    let inputText = '';

    // If upstream provided a rich message_data object, preserve it fully
    if (messageInput?.message_data) {
      const md = messageInput.message_data;
      if (md && typeof md === 'object') {
        inputText = md.input_text ?? '';
        return {
          message_data: md,
          user_input: inputText || (typeof messageInput === 'string' ? messageInput : '')
        };
      }
      // If message_data is a primitive, treat as text
      inputText = String(md);
      return { message_data: md, user_input: inputText };
    }

    // Handle other input formats
    if (typeof messageInput === 'string') {
      inputText = messageInput;
    } else if (messageInput?.input_text) {
      inputText = messageInput.input_text;
    } else if (messageInput?.user_input) {
      inputText = messageInput.user_input;
    } else if (messageInput && typeof messageInput === 'object') {
      // Fallback: stringify object
      inputText = JSON.stringify(messageInput);
    }

    return {
      message_data: { input_text: String(inputText), input_type: 'string' },
      user_input: inputText
    };
  }

  /**
   * Validate inputs and required settings
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    if (!inputs.message_data && !inputs.user_input) {
      throw new Error('OpenAI node requires message_data or user_input');
    }

    const settings = this.getCurrentSettings();
    if (!settings.model) {
      throw new Error('OpenAI node is not configured: please open Settings and select a Model (e.g., gpt-4o). Tip: double-click the OpenAI node to open its settings.');
    }
  }

  /**
   * Normalize execution result to have ai_response and carry metadata if present
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processedResult = await super.processExecutionResult(result);

    if (processedResult.success && processedResult.outputs) {
      // Normalize OpenAI outputs to a common key for UI/components
      if (!processedResult.outputs.ai_response && processedResult.outputs.response) {
        processedResult.outputs.ai_response = processedResult.outputs.response;
      }

      if (processedResult.metadata) {
        processedResult.outputs.metadata = processedResult.metadata;
      }
    }

    return processedResult;
  }

  /**
   * Extract last AI response (plain text) for summaries
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
   * Convert complex response payloads to plain text, stripping formatting
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
   * Convenience: get current model/system prompt
   */
  getCurrentModel(): string {
    const settings = this.getCurrentSettings();
    return settings.model || '';
  }

  getCurrentSystemPrompt(): string {
    const settings = this.getCurrentSettings();
    return settings.system_prompt || '';
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
