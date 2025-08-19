// src/components/nodes/hooks/useExecutionData.ts
import { useMemo } from 'react';
import { NodeDataWithHandlers } from '../registry';

/**
 * Custom React hook to extract and format execution data from node data.
 * 
 * This hook provides a modular way for all node components to access fresh execution results
 * from flow execution or webhook triggers. It prioritizes fresh execution data over cached
 * instance data and provides utility functions for common data access patterns.
 * 
 * The hook handles different types of node outputs:
 * - message_data: For input nodes (ChatInput, TelegramInput)
 * - ai_response: For AI processing nodes (OpenAI, DeepSeek)
 * - raw: For other node types with custom output formats
 * 
 * @hook
 * @example
 * ```tsx
 * import { useExecutionData } from './hooks/useExecutionData';
 * 
 * function MyNodeComponent({ data }: NodeComponentProps) {
 *   const {
 *     hasFreshResults,
 *     status,
 *     displayData,
 *     getOutputValue,
 *     isSuccess,
 *     isError
 *   } = useExecutionData(data);
 * 
 *   if (isSuccess && displayData.type === 'message_data') {
 *     return (
 *       <div>
 *         <p>Input: {displayData.inputText}</p>
 *         <p>Chat ID: {displayData.chatId}</p>
 *         <p>Status: {status}</p>
 *       </div>
 *     );
 *   }
 * 
 *   return <div>No execution data available</div>;
 * }
 * ```
 * 
 * @param data - The node data object containing instance data and execution results
 * @returns Object containing execution status, outputs, and utility functions
 * @returns returns.hasFreshResults - Boolean indicating if fresh execution results are available
 * @returns returns.status - Current execution status ('idle' | 'success' | 'error' | 'running')
 * @returns returns.executionTime - Time taken for execution in milliseconds
 * @returns returns.lastExecuted - Timestamp of last execution
 * @returns returns.outputs - Raw output data from node execution
 * @returns returns.getOutputValue - Function to get specific output value by port ID
 * @returns returns.displayData - Formatted display data with type-specific structure
 * @returns returns.instance - Original node instance data
 * @returns returns.instanceData - Node instance data object
 * @returns returns.isExecuted - Boolean indicating if node has been executed
 * @returns returns.isSuccess - Boolean indicating if last execution was successful
 * @returns returns.isError - Boolean indicating if last execution had an error
 * 
 * @since 1.0.0
 * @author Social Media Flow Builder Team
 */
export const useExecutionData = (data: NodeDataWithHandlers) => {
  return useMemo(() => {
    // Debug: Log the raw data being passed to the hook
    console.log('🔧 useExecutionData raw data:', {
      executionResult: (data as any)?.executionResult,
      outputs: (data as any)?.outputs,
      status: (data as any)?.status,
      executionTime: (data as any)?.executionTime,
      lastExecuted: (data as any)?.lastExecuted,
      _lastUpdated: (data as any)?._lastUpdated
    });
    
    // Get execution results from the updated node data (set by syncExecutionResults)
    const executionResult = (data as any)?.executionResult;
    const outputs = (data as any)?.outputs || executionResult?.outputs;
    const status = (data as any)?.status || executionResult?.status;
    const executionTime = (data as any)?.executionTime || executionResult?.execution_time_ms;
    const lastExecuted = (data as any)?.lastExecuted || executionResult?.completed_at;
    // Force re-evaluation when data changes (accessing _lastUpdated triggers useMemo recalculation)
    (data as any)?._lastUpdated;
    
    // Get static instance data as fallback
    const instance = data?.instance;
    const instanceData = instance?.data || {};
    
    // Determine if we have fresh execution results
    const hasFreshResults = Boolean(executionResult || outputs || status === 'success');
    
    // Get the most recent output data (execution results take priority over instance data)
    let currentOutputs = outputs || {};
    
    // If no outputs from fresh execution, check instance data
    if (!currentOutputs || Object.keys(currentOutputs).length === 0) {
      currentOutputs = instanceData.outputs || {};
      
      // If still no outputs, check lastExecution data (for webhook-triggered executions)
      if (Object.keys(currentOutputs).length === 0) {
        const lastExecution = instanceData?.lastExecution;
        if (lastExecution && lastExecution.outputs) {
          currentOutputs = lastExecution.outputs;
        }
      }
    }
    
    // Resolve last executed timestamp from either root-level data or instance lastExecution
    const resolvedLastExecuted = lastExecuted 
      || instanceData?.lastExecution?.completedAt 
      || instanceData?.lastExecution?.startedAt;
    
    // Extract specific output values based on node type
    const getOutputValue = (portId: string) => {
      return currentOutputs[portId];
    };
    
    // Get formatted display data for common output types
    const getDisplayData = () => {
      // For ChatInputNode and TelegramInputNode - show message_data
      if (currentOutputs.message_data) {
        return {
          type: 'message_data',
          inputText: currentOutputs.message_data.input_text || currentOutputs.message_data.chat_input,
          chatId: currentOutputs.message_data.chat_id,
          inputType: currentOutputs.message_data.input_type,
          sessionId: currentOutputs.message_data.session_id,
          timestamp: currentOutputs.message_data.timestamp,
          metadata: currentOutputs.message_data.metadata
        };
      }
      
      // For AI nodes (DeepSeek, OpenAI) - show ai_response
      if (currentOutputs.ai_response) {
        return {
          type: 'ai_response',
          inputText: currentOutputs.ai_response.input_text,
          aiResponse: currentOutputs.ai_response.ai_response,
          sessionId: currentOutputs.ai_response.session_id,
          timestamp: currentOutputs.ai_response.timestamp,
          metadata: currentOutputs.ai_response.metadata
        };
      }
      
      // Fallback - return raw outputs
      return {
        type: 'raw',
        data: currentOutputs
      };
    };
    
    return {
      // Execution status
      hasFreshResults,
      status: status || 'idle',
      executionTime,
      lastExecuted: resolvedLastExecuted,
      
      // Output data
      outputs: currentOutputs,
      getOutputValue,
      displayData: getDisplayData(),
      
      // Instance data (for settings, etc.)
      instance,
      instanceData,
      
      // Utility functions
      isExecuted: hasFreshResults || Boolean(instanceData.lastExecution),
      isSuccess: status === 'success',
      isError: status === 'error'
    };
  }, [data]);
};

export default useExecutionData;
