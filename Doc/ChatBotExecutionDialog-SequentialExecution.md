# ChatBotExecutionDialog Sequential Node Execution

## Overview

The ChatBotExecutionDialog component has been enhanced to support sequential node execution in the flow builder. This document outlines the implementation details, execution flow, and integration with the FlowBuilder store.

## Key Features

1. **Sequential Node Execution**: Nodes are executed one by one based on their connections in the flow, starting from the trigger node.
2. **Visual Status Indicators**: Each node's execution status (RUNNING, SUCCESS, ERROR, SKIPPED) is displayed with color-coded chips in the chat interface.
3. **Input Preparation**: Inputs for each node are prepared based on the outputs of previously executed nodes.
4. **Error Handling**: If a node execution fails, subsequent nodes are marked as skipped.
5. **Support for Different Trigger Types**: Both chat_input and voice_input trigger node types are supported.

## Implementation Details

### Node Execution Order

The execution order is determined using a breadth-first traversal of the flow graph:

```typescript
const buildNodeExecutionGraph = useCallback(() => {
  if (!triggerNodeId || !flowNodes.length || !flowEdges.length) return [];

  // Start with trigger node
  const executionOrder: string[] = [triggerNodeId];
  const visited = new Set<string>([triggerNodeId]);
  let currentNodes = [triggerNodeId];

  // Breadth-first traversal to find execution order
  while (currentNodes.length > 0) {
    const nextNodes: string[] = [];

    for (const nodeId of currentNodes) {
      // Find all edges where this node is the source
      const outgoingEdges = flowEdges.filter(edge => edge.source === nodeId);

      for (const edge of outgoingEdges) {
        const targetNodeId = edge.target;
        
        // Only add nodes we haven't visited yet
        if (!visited.has(targetNodeId)) {
          executionOrder.push(targetNodeId);
          nextNodes.push(targetNodeId);
          visited.add(targetNodeId);
        }
      }
    }

    currentNodes = nextNodes;
  }

  return executionOrder;
}, [triggerNodeId, flowNodes, flowEdges]);
```

### Sequential Execution

Nodes are executed sequentially with results from each node being passed to subsequent nodes:

```typescript
const executeNodesSequentially = async (triggerInputs: Record<string, any>) => {
  if (!nodeExecutionOrder.length) {
    throw new Error('No nodes to execute');
  }
  
  // Initialize execution results
  const results: Record<string, any> = {};
  
  try {
    // Start with trigger node
    setCurrentExecutingNodeIndex(0);
    const triggerNodeResult = await executeNode(nodeExecutionOrder[0], triggerInputs);
    results[nodeExecutionOrder[0]] = triggerNodeResult;
    
    // Execute remaining nodes in order
    for (let i = 1; i < nodeExecutionOrder.length; i++) {
      setCurrentExecutingNodeIndex(i);
      const nodeId = nodeExecutionOrder[i];
      
      // Prepare inputs for this node from previous results
      const nodeInputs = prepareNodeInputs(nodeId, results);
      
      // Execute the node
      const nodeResult = await executeNode(nodeId, nodeInputs);
      results[nodeId] = nodeResult;
    }
    
    // All nodes executed successfully
    return results;
  } catch (error) {
    // Mark remaining nodes as skipped
    for (let i = currentExecutingNodeIndex + 1; i < nodeExecutionOrder.length; i++) {
      const nodeId = nodeExecutionOrder[i];
      const node = flowNodes.find(n => n.id === nodeId);
      const nodeLabel = node?.data?.instance?.label || (node?.data?.nodeType as any)?.name || 'Node';
      
      addMessage({
        type: 'node_status',
        content: `${nodeLabel} skipped due to previous error`,
        nodeId: nodeId,
        status: NodeExecutionStatus.SKIPPED
      });
    }
    
    throw error as Error;
  } finally {
    setCurrentExecutingNodeIndex(-1);
  }
};
```

### Input Preparation

Inputs for each node are prepared based on outputs from previous nodes:

```typescript
const prepareNodeInputs = (nodeId: string, results: Record<string, any>): Record<string, any> => {
  const inputs: Record<string, any> = {};
  
  // Find all edges where this node is the target
  const incomingEdges = flowEdges.filter(edge => edge.target === nodeId);
  
  for (const edge of incomingEdges) {
    const sourceNodeId = edge.source;
    const sourcePortId = edge.sourceHandle || '';
    const targetPortId = edge.targetHandle || '';
    
    // If we have results for the source node
    if (results[sourceNodeId] && results[sourceNodeId].outputs) {
      // Extract the output from the source node's results
      const sourceOutput = results[sourceNodeId].outputs[sourcePortId.split('__')[1]] || 
                          results[sourceNodeId].outputs.default;
      
      if (sourceOutput !== undefined) {
        // Map to the target node's input
        const inputKey = targetPortId.split('__')[1] || 'default';
        inputs[inputKey] = sourceOutput;
      }
    }
  }
  
  return inputs;
};
```

## Integration with FlowBuilder Store

After execution, results are synchronized with the FlowBuilder store:

1. ChatBotExecutionDialog executes nodes sequentially
2. Results are passed to FlowBuilder's `handleFlowExecution` function
3. FlowBuilder calls `syncExecutionResults` to update the store
4. The store updates each node with its execution results
5. UI components react to the updated state

## Visual Indicators

Node execution status is displayed with color-coded chips:

- **RUNNING**: Blue with spinner
- **SUCCESS**: Green
- **ERROR**: Red
- **SKIPPED**: Gray

## Error Handling

If a node execution fails:
1. The error is caught and displayed
2. Subsequent nodes are marked as skipped
3. The error is propagated to the FlowBuilder for proper handling

## Support for Different Trigger Types

The dialog supports both chat_input and voice_input trigger types:
- **chat_input**: Text input field for user messages
- **voice_input**: Voice recording button for audio input
