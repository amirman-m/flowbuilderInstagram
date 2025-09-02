// ScheduledMessageNode Executor - SOLID-compliant orchestration for ScheduledMessage nodes
// Handles schedule configuration, execution, and UI updates for external orchestrators

import { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from '../core/NodeExecutor';
import { NodeInstance, NodeType } from '../../../types/nodes';

/**
 * Specialized executor for ScheduledMessage nodes
 * Handles schedule configuration and message data output formatting
 */
export class ScheduledMessageNodeExecutor extends NodeExecutor {
  
  constructor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    onNodeUpdate?: (nodeId: string, updates: Partial<NodeInstance>) => void
  ) {
    super(nodeId, instance, nodeType, onNodeUpdate);
  }

  /**
   * Execute ScheduledMessage node with schedule configuration
   * @param scheduleConfig - The schedule configuration object
   * @returns Execution result with message_data output
   */
  async executeWithScheduleConfig(
    scheduleConfig: {
      time_unit: string;
      time_value: number;
      message_content: string;
    },
    flowId: number
  ): Promise<NodeExecutionResult> {
    const context: NodeExecutionContext = {
      nodeId: this.nodeId,
      flowId,
      inputs: {
        settings: scheduleConfig
      }
    };

    return await this.execute(context);
  }

  /**
   * Validate ScheduledMessage-specific inputs
   */
  protected async validateInputs(inputs: Record<string, any>): Promise<void> {
    await super.validateInputs(inputs);
    
    const settings = inputs.settings;
    if (!settings || typeof settings !== 'object') {
      throw new Error('ScheduledMessage node requires settings object');
    }
    
    if (!settings.time_unit || !['seconds', 'minutes', 'hours'].includes(settings.time_unit)) {
      throw new Error('ScheduledMessage node requires valid time_unit (seconds, minutes, hours)');
    }
    
    if (!settings.time_value || typeof settings.time_value !== 'number') {
      throw new Error('ScheduledMessage node requires time_value as number');
    }
    
    if (!settings.message_content || typeof settings.message_content !== 'string') {
      throw new Error('ScheduledMessage node requires message_content as string');
    }
    
    if (!settings.message_content.trim()) {
      throw new Error('ScheduledMessage node requires non-empty message_content');
    }

    // Validate time unit/value combinations
    if (settings.time_unit === 'seconds' && ![30, 60].includes(settings.time_value)) {
      throw new Error('Seconds can only be 30 or 60');
    }
    
    if (settings.time_unit === 'minutes' && (settings.time_value < 1 || settings.time_value > 60)) {
      throw new Error('Minutes must be between 1 and 60');
    }
    
    if (settings.time_unit === 'hours' && (settings.time_value < 1 || settings.time_value > 24)) {
      throw new Error('Hours must be between 1 and 24');
    }
  }

  /**
   * Process ScheduledMessage execution result
   * Ensures proper message_data output format
   */
  protected async processExecutionResult(result: any): Promise<any> {
    const processedResult = await super.processExecutionResult(result);
    
    // Ensure outputs contain message_data in expected format
    if (processedResult.success && processedResult.outputs) {
      // Normalize message_data output for downstream nodes
      if (processedResult.outputs.message_data) {
        const messageData = processedResult.outputs.message_data;
        
        // Ensure consistent format
        if (typeof messageData === 'object' && messageData.input_text) {
          // Already in correct format
        } else if (typeof messageData === 'string') {
          // Convert string to object format
          processedResult.outputs.message_data = {
            input_text: messageData,
            scheduled: true,
            timestamp: new Date().toISOString(),
            input_type: 'scheduled'
          };
        }
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
   * Get schedule configuration from node settings
   */
  getScheduleConfig(): {
    time_unit: string;
    time_value: number;
    message_content: string;
  } | null {
    const settings = this.instance?.data?.settings;
    if (settings?.time_unit && settings?.time_value && settings?.message_content) {
      return {
        time_unit: settings.time_unit,
        time_value: settings.time_value,
        message_content: settings.message_content
      };
    }
    return null;
  }

  /**
   * Get formatted schedule description
   */
  getScheduleDescription(): string {
    const config = this.getScheduleConfig();
    if (config) {
      return `Every ${config.time_value} ${config.time_unit}`;
    }
    return 'Not configured';
  }

  /**
   * Check if node has been configured with schedule settings
   */
  isConfigured(): boolean {
    return this.getScheduleConfig() !== null;
  }

  /**
   * Get message content from configuration
   */
  getMessageContent(): string | null {
    const config = this.getScheduleConfig();
    return config?.message_content || null;
  }

  /**
   * Check if node has been executed with schedule
   */
  hasExecutedSchedule(): boolean {
    const lastExecution = this.instance?.data?.lastExecution;
    return lastExecution?.outputs?.message_data?.scheduled === true;
  }

  /**
   * Get execution summary for display in orchestrator
   */
  getExecutionSummary(): { 
    isConfigured: boolean;
    scheduleDescription?: string;
    messageContent?: string;
    lastExecuted?: string;
    hasExecuted: boolean;
  } {
    const config = this.getScheduleConfig();
    const lastExecution = this.instance?.data?.lastExecution;
    
    if (!config) {
      return { 
        isConfigured: false,
        hasExecuted: false
      };
    }
    
    return {
      isConfigured: true,
      scheduleDescription: this.getScheduleDescription(),
      messageContent: config.message_content,
      lastExecuted: lastExecution?.startedAt,
      hasExecuted: this.hasExecutedSchedule()
    };
  }

  /**
   * Calculate next execution time based on current schedule
   */
  calculateNextExecution(): Date | null {
    const config = this.getScheduleConfig();
    if (!config) return null;
    
    const now = new Date();
    
    switch (config.time_unit) {
      case 'seconds':
        return new Date(now.getTime() + config.time_value * 1000);
      case 'minutes':
        return new Date(now.getTime() + config.time_value * 60 * 1000);
      case 'hours':
        return new Date(now.getTime() + config.time_value * 60 * 60 * 1000);
      default:
        return null;
    }
  }
}
