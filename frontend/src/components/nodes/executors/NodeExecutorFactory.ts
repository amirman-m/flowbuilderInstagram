// NodeExecutor Factory - SOLID-compliant factory for creating node executors
// Follows Open/Closed Principle for easy extension with new node types

import { NodeExecutor } from '../core/NodeExecutor';
import { ChatInputNodeExecutor } from './ChatInputNodeExecutor';
import { DeepSeekChatNodeExecutor } from './DeepSeekChatNodeExecutor';
import { OpenAIChatNodeExecutor } from './OpenAIChatNodeExecutor';
import { TranscriptionNodeExecutor } from './TranscriptionNodeExecutor';
import { VoiceInputNodeExecutor } from './VoiceInputNodeExecutor';
import { DownloadTelegramVoiceNodeExecutor } from './DownloadTelegramVoiceNodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';
import { SwitchInputTypeNodeExecutor } from './SwitchInputTypeNodeExecutor';
import { TelegramInputNodeExecutor } from './TelegramInputNodeExecutor';
import { TelegramGroupEventCheckerNodeExecutor } from './TelegramGroupEventCheckerNodeExecutor';
import { OpenAISpeechNodeExecutor } from './OpenAISpeechNodeExecutor';
import { LanguageDetectionNodeExecutor } from './LanguageDetectionNodeExecutor';
import { LanguageTranslatorNodeExecutor } from './LanguageTranslatorNodeExecutor';
import { ScheduledMessageNodeExecutor } from './ScheduledMessageNodeExecutor';

/**
 * Factory for creating appropriate NodeExecutor instances
 * Follows SOLID principles and allows easy extension for new node types
 */
type ExecutorConstructor = new (
  nodeId: string,
  instance: NodeInstance,
  nodeType: NodeType,
  onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void
) => NodeExecutor;

export class NodeExecutorFactory {
  private static executorRegistry = new Map<string, ExecutorConstructor>();

  static {
    // Register built-in executors
    NodeExecutorFactory.registerExecutor('chat_input', ChatInputNodeExecutor);
    NodeExecutorFactory.registerExecutor('simple-deepseek-chat', DeepSeekChatNodeExecutor);
    NodeExecutorFactory.registerExecutor('simple-openai-chat', OpenAIChatNodeExecutor);
    NodeExecutorFactory.registerExecutor('transcription', TranscriptionNodeExecutor);
    NodeExecutorFactory.registerExecutor('voice_input', VoiceInputNodeExecutor);
    NodeExecutorFactory.registerExecutor('download_telegram_voice', DownloadTelegramVoiceNodeExecutor);
    NodeExecutorFactory.registerExecutor('switch-input-type', SwitchInputTypeNodeExecutor);
    NodeExecutorFactory.registerExecutor('telegram_input', TelegramInputNodeExecutor);
    NodeExecutorFactory.registerExecutor('telegram_group_event_checker', TelegramGroupEventCheckerNodeExecutor);
    NodeExecutorFactory.registerExecutor('openai_speech', OpenAISpeechNodeExecutor);
    NodeExecutorFactory.registerExecutor('multilingual-e5-language-detection', LanguageDetectionNodeExecutor);
    NodeExecutorFactory.registerExecutor('language-translator-m2m100', LanguageTranslatorNodeExecutor);
    NodeExecutorFactory.registerExecutor('scheduled_message', ScheduledMessageNodeExecutor);
  }

  /**
   * Register a new executor type (Open/Closed Principle)
   */
  static registerExecutor(nodeTypeId: string, executorClass: ExecutorConstructor): void {
    this.executorRegistry.set(nodeTypeId, executorClass);
  }

  /**
   * Create executor for a specific node
   */
  static createExecutor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void
  ): NodeExecutor | null {
    const nodeTypeId = nodeType?.id;
    if (!nodeTypeId) {
      console.warn(`No node type ID found for node ${nodeId}`);
      return null;
    }

    const ExecutorClass = this.executorRegistry.get(nodeTypeId);
    if (!ExecutorClass) {
      console.warn(`No executor registered for node type: ${nodeTypeId}`);
      return null;
    }

    return new ExecutorClass(nodeId, instance, nodeType, onNodeUpdate);
  }

  /**
   * Check if executor exists for node type
   */
  static hasExecutor(nodeTypeId: string): boolean {
    return this.executorRegistry.has(nodeTypeId);
  }

  /**
   * Get all registered executor types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(this.executorRegistry.keys());
  }
}
