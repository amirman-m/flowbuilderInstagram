import { useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

export interface NodeInput {
  portId: string;
  value: any;
  sourceNodeId: string;
  sourcePortId: string;
}

export interface UseNodeInputsResult {
  inputs: Record<string, any>;
  collectInputs: () => Promise<Record<string, any>>;
  isCollecting: boolean;
  inputSources: NodeInput[];
}

/**
 * Hook for collecting input data from connected nodes
 * This provides a clean, reusable way for any node to get its input data
 */
export const useNodeInputs = (nodeId: string): UseNodeInputsResult => {
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [isCollecting, setIsCollecting] = useState(false);
  const [inputSources, setInputSources] = useState<NodeInput[]>([]);
  
  const { getNodes, getEdges } = useReactFlow();

  const collectInputs = useCallback(async (): Promise<Record<string, any>> => {
    setIsCollecting(true);
    
    try {
      const nodes = getNodes();
      const edges = getEdges();
      const collectedInputs: Record<string, any> = {};
      const sources: NodeInput[] = [];
      
      // Find all edges that connect to this node's input ports
      const incomingEdges = edges.filter(edge => edge.target === nodeId);
      
      console.log(`🔍 [${nodeId}] Found ${incomingEdges.length} incoming edges`);
      
      for (const edge of incomingEdges) {
        // Find the source node
        const sourceNode = nodes.find(node => node.id === edge.source);
        if (!sourceNode) {
          console.warn(`❌ [${nodeId}] Source node ${edge.source} not found`);
          continue;
        }
        
        // Extract execution results from source node
        const sourceNodeData = sourceNode.data || {};
        let sourceOutput;
        
        // Try different paths to find execution results
        const executionPaths = [
          // New structure (your updated implementation)
          sourceNodeData?.instance?.data?.lastExecution?.outputs,
          // Legacy structure (fallback)
          sourceNodeData?.executionResult?.outputs,
          sourceNodeData?.lastExecution?.outputs,
          // Direct outputs
          sourceNodeData?.outputs
        ];
        
        let executionOutputs;
        for (const path of executionPaths) {
          if (path && typeof path === 'object') {
            executionOutputs = path;
            break;
          }
        }
        
        if (!executionOutputs) {
          console.warn(`⚠️ [${nodeId}] Source node ${sourceNode.id} has no execution outputs`);
          // Set empty/null value to indicate missing input
          const targetPort = edge.targetHandle || 'input';
          collectedInputs[targetPort] = null;
          continue;
        }
        
        // Get the specific output port data
        const sourcePortId = edge.sourceHandle || 'output';
        sourceOutput = executionOutputs[sourcePortId];
        
        if (sourceOutput !== undefined && sourceOutput !== null) {
          const targetPort = edge.targetHandle || 'input';
          collectedInputs[targetPort] = sourceOutput;
          
          sources.push({
            portId: targetPort,
            value: sourceOutput,
            sourceNodeId: edge.source,
            sourcePortId: sourcePortId
          });
          
          console.log(`✅ [${nodeId}] Collected input from ${edge.source}:${sourcePortId} -> ${targetPort}`, sourceOutput);
        } else {
          console.warn(`⚠️ [${nodeId}] No data found for port ${sourcePortId} in source node ${edge.source}`);
          const targetPort = edge.targetHandle || 'input';
          collectedInputs[targetPort] = null;
        }
      }
      
      console.log(`📥 [${nodeId}] Final collected inputs:`, collectedInputs);
      
      setInputs(collectedInputs);
      setInputSources(sources);
      
      return collectedInputs;
      
    } catch (error) {
      console.error(`❌ [${nodeId}] Error collecting inputs:`, error);
      return {};
    } finally {
      setIsCollecting(false);
    }
  }, [nodeId, getNodes, getEdges]);

  return {
    inputs,
    collectInputs,
    isCollecting,
    inputSources
  };
};