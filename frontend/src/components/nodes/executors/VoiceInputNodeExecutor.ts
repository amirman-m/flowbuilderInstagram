// VoiceInputNode Executor - SOLID-compliant orchestration for Voice Input nodes
// Handles audio capture payload, execution, and UI updates for external orchestrators

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for Voice Input nodes
 * Builds proper inputs from recorded audio and triggers execution
 */
export class VoiceInputNodeExecutor extends NodeExecutor {
  constructor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void
  ) {
    super(nodeId, instance, nodeType, onNodeUpdate);
  }

  /**
   * Execute Voice Input node with a recorded audio Blob
   * @param audioBlob - Recorded audio as a Blob
   * @param flowId - Current flow id
   * @param options - Optional flags, e.g. send_to_transcription
   */
  async executeWithAudioBlob(
    audioBlob: Blob,
    flowId: number,
    options?: { send_to_transcription?: boolean }
  ): Promise<NodeExecutionResult> {
    const base64Audio = await this.blobToBase64(audioBlob);

    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: {
        voice_data: base64Audio,
        content_type: audioBlob.type,
        send_to_transcription: options?.send_to_transcription ?? true,
      },
    };

    return await this.execute(context);
  }

  /**
   * Execute when audio is already encoded as base64
   */
  async executeWithBase64(
    base64Audio: string,
    contentType: string,
    flowId: number,
    options?: { send_to_transcription?: boolean }
  ): Promise<NodeExecutionResult> {
    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: {
        voice_data: base64Audio,
        content_type: contentType,
        send_to_transcription: options?.send_to_transcription ?? true,
      },
    };

    return await this.execute(context);
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    // btoa expects binary string; this mirrors existing VoiceInputNode.tsx conversion
    return btoa(binary);
  }
}
