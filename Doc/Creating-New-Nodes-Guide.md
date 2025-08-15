# Creating New Nodes: A Practical Guide

This guide provides step-by-step instructions for creating new nodes in the Social Media Flow Builder application, using the ChatInputNode as a canonical example.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Guide](#step-by-step-guide)
4. [Best Practices](#best-practices)
5. [Testing Your Node](#testing-your-node)
6. [Troubleshooting](#troubleshooting)

## Overview

The node system in the Social Media Flow Builder is designed to be modular and extensible. Each node consists of:

1. **Backend Node Type Definition**: Defines the node's metadata, ports, and execution logic
2. **Frontend Node Component**: Implements the node's UI and interaction logic
3. **Registry Entries**: Maps the node type to its component and configuration

This guide will walk you through creating a new node similar to the ChatInputNode, which allows users to input text messages into a flow.

## Prerequisites

Before creating a new node, ensure you have:

1. Access to both frontend and backend codebases
2. Understanding of React and TypeScript
3. Familiarity with the node architecture (see NodeComponent-Architecture.md)
4. Development environment set up

## Step-by-Step Guide

### 1. Define Node Type in Backend

First, create a Python class for your node in the backend:

```python
# backend/app/core/nodes/trigger/your_input_node.py
from app.core.nodes.base import BaseNode, NodeExecutionResult
from app.core.nodes.ports import PortType

class YourInputNode(BaseNode):
    def __init__(self):
        super().__init__(
            node_id="your_input_node",
            name="Your Input Node",
            description="A custom input node for your specific use case",
            category="trigger",
            version="1.0.0"
        )
        
        # Define input ports (if any)
        self.add_input_port(
            id="control",
            name="Control",
            description="Control input to trigger execution",
            port_type=PortType.CONTROL,
            required=False
        )
        
        # Define output ports
        self.add_output_port(
            id="message",
            name="Message",
            description="The output message",
            port_type=PortType.MESSAGE,
            required=True
        )
        
        # Define settings schema
        self.settings_schema = {
            "type": "object",
            "properties": {
                "default_text": {
                    "type": "string",
                    "title": "Default Text",
                    "description": "Default text to show in the input field"
                }
            }
        }
    
    async def execute(self, context: dict) -> NodeExecutionResult:
        # Get user input from execution context
        user_input = context.get("user_input", "")
        
        if not user_input:
            return NodeExecutionResult(
                success=False,
                outputs={},
                logs=["No user input provided"]
            )
        
        # Process the input (you can add your custom logic here)
        word_count = len(user_input.split())
        
        # Return the execution result
        return NodeExecutionResult(
            success=True,
            outputs={
                "message": {
                    "type": "message_data",
                    "content": user_input,
                    "metadata": {
                        "word_count": word_count,
                        "timestamp": context.get("timestamp", "")
                    }
                }
            },
            logs=[f"Processed input with {word_count} words"]
        )
```

### 2. Register the Node in Backend

Add your node to the node registry in the backend:

```python
# backend/app/core/nodes/__init__.py
from app.core.nodes.trigger.your_input_node import YourInputNode

# Add to NODE_TYPES list
NODE_TYPES = [
    # ... existing nodes
    YourInputNode(),
]
```

### 3. Create Frontend Node Component

Create a new TypeScript file for your node component:

```tsx
// frontend/src/components/nodes/node-types/YourInputNode.tsx
import React, { useState } from 'react';
import { 
  Box, Typography, Dialog, TextField, Button, Alert
} from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { NodeExecutionStatus } from '../../../types/nodes';
import { nodeService } from '../../../services/nodeService';
import { useParams } from 'react-router-dom';
import { BaseNode } from '../BaseNode';
import { useNodeConfiguration, useExecutionData } from '../hooks';

export const YourInputNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const { flowId } = useParams<{ flowId: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [executing, setExecuting] = useState(false);
  
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeUpdate } = nodeData;
  
  // Use our modular hooks
  const nodeConfig = useNodeConfiguration(nodeType?.id || 'your_input_node');
  const executionData = useExecutionData(nodeData);
  
  // Get default text from settings
  const defaultText = instance?.settings?.default_text || '';
  
  const handleExecute = async () => {
    setDialogOpen(true);
    // Initialize with default text if available
    setInputText(defaultText);
  };
  
  const handleSubmit = async () => {
    if (!inputText.trim() || !flowId || !id) return;
    
    try {
      setExecuting(true);
      console.log('Executing Your Input node...');
      
      // Auto-save flow to ensure node exists in database
      try {
        await new Promise((resolve, reject) => {
          const saveFlowEvent = new CustomEvent('autoSaveFlow', {
            detail: { 
              nodeId: id, 
              reason: 'pre-execution',
              callback: (error?: Error) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(null);
                }
              }
            }
          });
          window.dispatchEvent(saveFlowEvent);
        });
      } catch (saveError) {
        console.warn('Auto-save failed, continuing with execution:', saveError);
      }
      
      // Call backend API to execute the node
      const executionContext = {
        user_input: inputText.trim(),
        timestamp: new Date().toISOString()
      };
      
      const result = await nodeService.execution.executeNode(
        parseInt(flowId), 
        id,
        executionContext
      );
      
      console.log('Execution result:', result);
      
      setDialogOpen(false);
      
      // Update node state with execution results
      if (onNodeUpdate && result) {
        const lastExecution = {
          timestamp: new Date().toISOString(),
          status: result.status || NodeExecutionStatus.SUCCESS,
          outputs: result.outputs || {}
        };
        
        onNodeUpdate(id, {
          data: {
            ...instance.data,
            lastExecution
          }
        });
      }
    } catch (error: any) {
      console.error('Execution failed:', error);
      // Keep dialog open on error so user can retry
    } finally {
      setExecuting(false);
    }
  };

  // Custom content for the node
  const customContent = (
    <>
      {/* Execution Results Display */}
      {executionData.hasFreshResults && executionData.displayData.type === 'message_data' && (
        <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: nodeConfig?.color }}>
            Latest Input:
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
            "{executionData.displayData.inputText}"
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            {executionData.displayData.metadata?.word_count} words • {new Date(executionData.displayData.timestamp).toLocaleTimeString()}
          </Typography>
        </Box>
      )}
      
      {/* Success indicator for fresh execution */}
      {executionData.hasFreshResults && executionData.isSuccess && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">
            Input processed successfully
          </Typography>
        </Alert>
      )}
      
      {/* Input dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <Box sx={{ p: 3, width: 400 }}>
          <Typography variant="h6">Enter Your Input</Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message here..."
            sx={{ my: 2 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={handleSubmit}
              disabled={!inputText.trim() || executing}
            >
              {executing ? 'Processing...' : 'Submit'}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </>
  );

  return (
    <BaseNode
      {...props}
      nodeConfig={nodeConfig}
      onExecute={handleExecute}
      customContent={customContent}
      executionStatus={executing ? NodeExecutionStatus.RUNNING : undefined}
    />
  );
};
```

### 4. Register the Node in Frontend Registry

Add your node to the component registry:

```tsx
// frontend/src/components/nodes/registry.tsx
import { YourInputNode } from './node-types/YourInputNode';

export const nodeComponentRegistry: Record<string, React.FC<NodeComponentProps>> = {
  // Existing nodes
  'your_input_node': YourInputNode,
};
```

### 5. Add Node to Frontend Configuration

Register your node in the frontend configuration:

```typescript
// frontend/src/config/nodeRegistry.ts
export const NODE_REGISTRY: Record<string, NodeRegistryEntry> = {
  // Existing nodes
  'your_input_node': {
    category: NodeCategory.TRIGGER,
    subcategory: 'Input Nodes',
    componentName: 'YourInputNode',
    features: {
      hasSettings: true,
      hasExecution: true,
      hasCustomUI: true,
      hasStatusIndicator: true
    }
  },
};
```

### 6. Add Node Icon (Optional)

Create an icon component for your node:

```tsx
// frontend/src/components/icons/YourInputIcon.tsx
import React from 'react';
import { SvgIcon } from '@mui/material';

export const YourInputIcon: React.FC = (props) => (
  <SvgIcon {...props}>
    {/* Your custom SVG path here */}
    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
  </SvgIcon>
);
```

Register the icon:

```typescript
// frontend/src/config/nodeIcons.ts
import { YourInputIcon } from '../components/icons/YourInputIcon';

export const NODE_ICONS: Record<string, NodeIconComponent> = {
  // Existing icons
  'your_input_node': YourInputIcon,
};
```

### 7. Export the Node Component

Add your node to the index file:

```typescript
// frontend/src/components/nodes/node-types/index.ts
export * from './YourInputNode';
```

## Best Practices

### 1. Component Structure

Follow this structure for your node components:

```
YourNodeComponent
├── State Management (useState hooks)
├── Data Access (useNodeConfiguration, useExecutionData)
├── Event Handlers (handleExecute, handleSubmit)
├── Custom Content (UI specific to this node)
└── BaseNode (wrapper with shared functionality)
```

### 2. Error Handling

Always implement proper error handling:

```typescript
try {
  // Your execution code
} catch (error) {
  console.error('Operation failed:', error);
  // Update UI to show error state
} finally {
  // Clean up resources, reset loading states
}
```

### 3. Performance Optimization

Use React's optimization features:

```typescript
// Memoize expensive calculations
const processedData = useMemo(() => {
  // Complex data processing
  return result;
}, [dependencies]);

// Memoize event handlers
const handleClick = useCallback(() => {
  // Event handling logic
}, [dependencies]);
```

### 4. Styling Consistency

Use the shared styling system:

```typescript
// Use the node theme system
const styles = useNodeStyles(nodeConfig, {
  selected,
  hovered,
  executing,
  executionStatus
});
```

### 5. Type Safety

Always use proper TypeScript types:

```typescript
// Define proper interfaces
interface YourNodeSettings {
  defaultText: string;
  otherSetting?: number;
}

// Use type assertions carefully
const settings = instance?.settings as YourNodeSettings;
```

## Testing Your Node

### 1. Manual Testing

1. Start the development server
2. Open the flow builder
3. Drag your node from the node library to the canvas
4. Test execution with various inputs
5. Verify connections with other nodes work correctly
6. Check error handling by triggering edge cases

### 2. Unit Testing

Create unit tests for your node component:

```typescript
// frontend/src/components/nodes/node-types/__tests__/YourInputNode.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { YourInputNode } from '../YourInputNode';

describe('YourInputNode', () => {
  const mockProps = {
    id: 'test-node-1',
    selected: false,
    data: {
      nodeType: { id: 'your_input_node' },
      instance: { settings: { default_text: 'Test' } },
      onNodeUpdate: jest.fn()
    }
  };

  it('renders correctly', () => {
    render(<YourInputNode {...mockProps} />);
    // Add assertions
  });

  it('opens dialog on execute', () => {
    render(<YourInputNode {...mockProps} />);
    // Add assertions
  });

  // Add more tests
});
```

## Troubleshooting

### Common Issues and Solutions

1. **Node not appearing in library**
   - Check if it's registered in both backend and frontend
   - Verify NODE_REGISTRY entry has correct category and subcategory

2. **Execution not working**
   - Check browser console for errors
   - Verify backend node class is properly registered
   - Ensure ports are correctly defined

3. **UI not updating after execution**
   - Verify onNodeUpdate is called with correct data structure
   - Check if useExecutionData is extracting data correctly

4. **Type errors**
   - Ensure all required props are provided to BaseNode
   - Check for null/undefined values before accessing properties

5. **Styling issues**
   - Use the node theme system consistently
   - Check if nodeConfig is loaded correctly

## Example: ChatInputNode Analysis

The ChatInputNode is a canonical example of a well-implemented node:

### Key Components

1. **State Management**:
   ```typescript
   const [dialogOpen, setDialogOpen] = useState(false);
   const [inputText, setInputText] = useState('');
   const [executing, setExecuting] = useState(false);
   ```

2. **Hook Usage**:
   ```typescript
   const nodeConfig = useNodeConfiguration(nodeType?.id || 'chat_input');
   const executionData = useExecutionData(nodeData);
   ```

3. **Execution Flow**:
   - User clicks execute button → dialog opens
   - User enters text and submits → backend execution
   - Result updates node state → UI reflects changes

4. **Custom UI**:
   - Dialog for text input
   - Formatted display of execution results
   - Success indicators and metadata

5. **BaseNode Integration**:
   ```typescript
   return (
     <BaseNode
       {...props}
       nodeConfig={nodeConfig}
       onExecute={handleExecute}
       customContent={customContent}
       executionStatus={executing ? NodeExecutionStatus.RUNNING : undefined}
     />
   );
   ```

By following this pattern and the best practices outlined above, you can create consistent, maintainable node components that integrate seamlessly with the flow builder system.
