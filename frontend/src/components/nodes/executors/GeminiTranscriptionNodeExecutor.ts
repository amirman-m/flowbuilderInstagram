// GeminiTranscriptionNode Executor - SOLID-compliant orchestration for Google Gemini transcription nodes

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for Google Gemini Transcription nodes
 * Handles audio input processing and transcription response normalization
 */
export class GeminiTranscriptionNodeExecutor extends NodeExecutor {
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
   * Execute Gemini Transcription node with audio input
   */
  async executeWithAudioInput(audioInput: any, flowId: number): Promise<NodeExecutionResult> {
    const preparedInputs = this.prepareInputsFromAudio(audioInput);
    this.lastInputs = preparedInputs;

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: preparedInputs
    };

    return await this.execute(context);
  }

  /**
   * Prepare inputs from audio data
   */
  private prepareInputsFromAudio(audioInput: any): Record<string, any> {
    let audioData = '';
    
    // Handle different audio input formats
    if (typeof audioInput === 'string') {
      audioData = audioInput;
    } else if (audioInput?.audio_data) {
      audioData = audioInput.audio_data;
    } else if (audioInput?.audio) {
      audioData = audioInput.audio;
    } else if (audioInput?.voice_output) {
      audioData = audioInput.voice_output;
    } else if (audioInput && typeof audioInput === 'object') {
      // Try to find base64 audio data in the object
      const possibleKeys = ['base64', 'data', 'content', 'file_data'];
      for (const key of possibleKeys) {
        if (audioInput[key] && typeof audioInput[key] === 'string') {
          audioData = audioInput[key];
          break;
        }
      }
      
      if (!audioData) {
        audioData = JSON.stringify(audioInput);
      }
    }

    return {
      audio_data: audioData
    };
  }

  /**
   * Validate inputs and required settings
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);

    if (!inputs.audio_data) {
      throw new Error('Gemini Transcription node requires audio_data input');
    }

    const settings = this.getCurrentSettings();
    if (!settings.model) {
      throw new Error('Gemini Transcription node is not configured: please open Settings and select a Model. Tip: double-click the Gemini node to open its settings.');
    }
  }

  /**
   * Normalize execution result to have transcription_output
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processedResult = await super.processExecutionResult(result);

    if (processedResult.success && processedResult.outputs) {
      // Normalize Gemini outputs to a common key for UI/components
      if (!processedResult.outputs.transcription_output && processedResult.outputs.transcription) {
        processedResult.outputs.transcription_output = processedResult.outputs.transcription;
      }

      if (processedResult.metadata) {
        processedResult.outputs.metadata = processedResult.metadata;
      }
    }

    return processedResult;
  }

  /**
   * Extract last transcription text for summaries
   */
  getLastTranscription(): string | null {
    const lastExecution = this.instance?.data?.lastExecution;
    if (lastExecution?.outputs?.transcription_output) {
      return this.extractPlainTextResponse(lastExecution.outputs.transcription_output);
    }
    if (lastExecution?.outputs?.transcription) {
      return this.extractPlainTextResponse(lastExecution.outputs.transcription);
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
      if (typeof response.transcription === 'string') {
        text = response.transcription;
      } else if (typeof response.transcription_output === 'string') {
        text = response.transcription_output;
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
   * Convenience: get current model and settings
   */
  getCurrentModel(): string {
    const settings = this.getCurrentSettings();
    return settings.model || '';
  }

  getCurrentLanguage(): string {
    const settings = this.getCurrentSettings();
    return settings.language || 'auto';
  }

  getCurrentPrompt(): string {
    const settings = this.getCurrentSettings();
    return settings.prompt || '';
  }

  isConfigured(): boolean {
    const settings = this.getCurrentSettings();
    return !!settings.model;
  }

  /**
   * Provide a summary for orchestrators/inspector panels
   */
  getExecutionSummary(): {
    hasTranscription: boolean;
    transcriptionText?: string;
    model?: string;
    language?: string;
    timestamp?: string;
  } {
    const lastTranscription = this.getLastTranscription();
    const lastExecution = this.instance?.data?.lastExecution;
    const settings = this.getCurrentSettings();

    if (!lastTranscription) {
      return { hasTranscription: false };
    }

    return {
      hasTranscription: true,
      transcriptionText: lastTranscription,
      model: settings.model,
      language: settings.language || 'auto',
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
