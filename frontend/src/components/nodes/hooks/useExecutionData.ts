// src/components/nodes/hooks/useExecutionData.ts
import { useMemo } from 'react';
import { NodeDataWithHandlers } from '../registry';

/**
 * Custom hook to extract and format execution data from node data
 * This provides a modular way for all node components to access fresh execution results
 */
export const useExecutionData = (data: NodeDataWithHandlers) => {
  return useMemo(() => {
    // Get execution results from the updated node data (set by syncNodeStatesWithExecutionResults)
    const executionResult = (data as any)?.executionResult;
    const outputs = (data as any)?.outputs;
    const status = (data as any)?.status;
    const executionTime = (data as any)?.executionTime;
    const lastExecuted = (data as any)?.lastExecuted;
    
    // Get static instance data as fallback
    const instance = data?.instance;
    const instanceData = instance?.data || {};
    
    // Determine if we have fresh execution results
    const hasFreshResults = Boolean(executionResult && outputs);
    
    // Get the most recent output data (execution results take priority over instance data)
    const currentOutputs = hasFreshResults ? outputs : (instanceData.outputs || {});
    
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
      lastExecuted,
      
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
