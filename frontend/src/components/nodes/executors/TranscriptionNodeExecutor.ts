// TranscriptionNode Executor - Orchestrates audio transcription nodes
// Ensures inputs are built correctly and outputs normalized to ai_response

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

export class TranscriptionNodeExecutor extends NodeExecutor {
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
   * Execute with base64 audio payload (compatible with VoiceInput output)
   */
  async executeWithBase64Audio(
    base64Audio: string,
    contentType: string,
    flowId: number,
    options?: { send_to_transcription?: boolean }
  ): Promise<NodeExecutionResult> {
    const inputs = {
      voice_data: base64Audio,
      content_type: contentType,
      send_to_transcription: options?.send_to_transcription ?? true,
    };

    this.lastInputs = inputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs,
    };

    return await this.execute(context);
  }

  /**
   * Validate transcription-specific inputs
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    // Normalize inputs to handle different input structures
    let normalizedInputs = { ...inputs };
    
    // Case 1: Check if voice input is nested inside message_data
    if (inputs.message_data && typeof inputs.message_data === 'object') {
      const messageData = inputs.message_data;
      
      // Extract voice_input from message_data if available
      if (messageData.voice_input) {
        console.log('🎙️ TranscriptionNodeExecutor: Found voice_input in message_data');
        normalizedInputs.voice_data = messageData.voice_input;
        
        // Always set send_to_transcription to true
        messageData.send_to_transcription = true;
        
        // Extract content_type from metadata if available
        if (messageData.metadata && messageData.metadata.content_type) {
          normalizedInputs.content_type = messageData.metadata.content_type;
        } else {
          // Default content type if not provided
          normalizedInputs.content_type = 'audio/wav';
        }
      }
    }
    
    // Case 2: Scan all input entries for voice_input
    for (const [key, value] of Object.entries(inputs)) {
      if (value && typeof value === 'object') {
        // Check if this object has voice_input
        if (value.voice_input) {
          console.log(`🎙️ TranscriptionNodeExecutor: Found voice_input in ${key}`);
          normalizedInputs.voice_data = value.voice_input;
          
          // Always set send_to_transcription to true
          value.send_to_transcription = true;
          
          // Try to extract content_type from metadata
          if (value.metadata && value.metadata.content_type) {
            normalizedInputs.content_type = value.metadata.content_type;
          } else {
            // Default content type if not provided
            normalizedInputs.content_type = 'audio/wav';
          }
        }
        
        // Check if this object has message_data with voice_input
        if (value.message_data && typeof value.message_data === 'object' && value.message_data.voice_input) {
          console.log(`🎙️ TranscriptionNodeExecutor: Found voice_input in ${key}.message_data`);
          normalizedInputs.voice_data = value.message_data.voice_input;
          
          // Always set send_to_transcription to true
          value.message_data.send_to_transcription = true;
          
          // Try to extract content_type from metadata
          if (value.message_data.metadata && value.message_data.metadata.content_type) {
            normalizedInputs.content_type = value.message_data.metadata.content_type;
          } else {
            // Default content type if not provided
            normalizedInputs.content_type = 'audio/wav';
          }
        }
      }
    }
    
    // Update the instance's lastInputs with normalized data
    this.lastInputs = normalizedInputs;
    
    // Check for voice_data after normalization
    if (!normalizedInputs.voice_data) {
      throw new Error('Transcription node requires voice input data. Please connect a Voice Input node.');
    }
    
    // Make content_type optional to avoid blocking execution
    if (!normalizedInputs.content_type) {
      console.warn('Transcription node: content_type not provided, will attempt to process anyway');
      normalizedInputs.content_type = 'audio/wav'; // Default to WAV format
    }
  }

  /**
   * Normalize outputs for UI/components
   * - If backend returns { transcription: { text } }, map to ai_response
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processed = await super.processExecutionResult(result);

    if (processed?.success && processed.outputs) {
      const out = processed.outputs;

      // Map common transcription shapes to ai_response
      if (!out.ai_response) {
        if (out.transcription && typeof out.transcription === 'object' && typeof out.transcription.text === 'string') {
          out.ai_response = out.transcription.text;
        } else if (typeof out.transcription === 'string') {
          out.ai_response = out.transcription;
        } else if (out.response) {
          out.ai_response = out.response;
        }
      }

      // Attach metadata passthrough if present
      if (processed.metadata) {
        out.metadata = processed.metadata;
      }
    }

    return processed;
  }

  /**
   * Persist last inputs and execution for inspector consistency
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
