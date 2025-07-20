# Node Architecture Documentation

## Overview

This document explains the simple, modular node architecture for the Social Media Flow Builder application. The architecture allows developers to easily create new node types using a clean registry pattern.

## Architecture Components

### 1. Core Files

```
frontend/src/components/nodes/
├── registry.tsx              ← Maps node IDs to components
├── NodeComponentFactory.tsx  ← Routes to correct component  
├── styles.ts                 ← Shared styling
├── node-types/
│   ├── index.ts              ← Barrel exports
│   ├── ChatInputNode.tsx     ← Working chat input node
│   └── InstagramTriggerNode.tsx ← Example new node
└── CustomNodes.tsx           ← Legacy (can ignore)
```

### 2. Registry System (`registry.tsx`)

- **Purpose**: Central registry mapping node type IDs to React components
- **Key Components**:
  - `NodeComponentProps`: Interface all nodes must implement
  - `NodeDataWithHandlers`: Extended data type with handlers
  - `nodeComponentRegistry`: The main registry object
  - `getNodeComponent()`: Function to retrieve components

### 3. Node Factory (`NodeComponentFactory.tsx`)

- **Purpose**: Factory that routes to the correct node component
- **Features**: 
  - Validates node data
  - Falls back to DefaultNode if needed
  - Handles component instantiation

### 4. Shared Styling (`styles.ts`)

- **Purpose**: Consistent styling across all nodes
- **Features**:
  - `baseNodeStyles`: Common styling for all nodes
  - `getCategoryColor()`: Category-based color coding

## How to Create New Nodes

### Step 1: Create Your Node Component

Follow the same pattern as `ChatInputNode.tsx`:

```typescript
// node-types/MyNewNode.tsx
import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Paper, Box, Typography, IconButton, Chip } from '@mui/material';
import { MyIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { baseNodeStyles, getCategoryColor } from '../styles';
import { NodeCategory } from '../../../types/nodes';

export const MyNewNode: React.FC<NodeComponentProps> = ({ data, selected, id }) => {
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance, onNodeDelete } = nodeData;
  const categoryColor = getCategoryColor(nodeType.category);
  
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onNodeDelete && id) {
      onNodeDelete(id);
    }
  };

  return (
    <Paper 
      sx={{
        ...baseNodeStyles,
        borderColor: selected ? categoryColor : `${categoryColor}80`,
        borderWidth: selected ? 3 : 2,
        backgroundColor: selected ? `${categoryColor}10` : 'white'
      }}
    >
      {/* Input Handles */}
      {nodeType.ports.inputs.map((port: any, index: number) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{
            top: `${20 + (index * 20)}px`,
            backgroundColor: port.required ? categoryColor : '#999'
          }}
        />
      ))}
      
      {/* Node Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Box sx={{ color: categoryColor, mr: 1 }}>
          <MyIcon />
        </Box>
        <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
          {instance.label || "My New Node"}
        </Typography>
        <IconButton size="small" onClick={handleDelete} sx={{ ml: 0.5 }}>
          <DeleteIcon fontSize="small" color="error" />
        </IconButton>
      </Box>

      {/* Node Category */}
      <Chip
        label={nodeType.category}
        size="small"
        sx={{
          backgroundColor: `${categoryColor}20`,
          color: categoryColor,
          fontSize: '0.7rem',
          height: '20px'
        }}
      />
      
      {/* Custom Content */}
      <Box sx={{ mt: 1, fontSize: '0.8rem', color: '#666' }}>
        Your custom content here
      </Box>
      
      {/* Output Handles */}
      {nodeType.ports.outputs.map((port: any, index: number) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{
            top: `${20 + (index * 20)}px`,
            backgroundColor: categoryColor
          }}
        />
      ))}
    </Paper>
  );
};
```

### Step 2: Register Your Node

Add it to the registry:

```typescript
// In registry.tsx
import { ChatInputNode } from './node-types/ChatInputNode';
import { MyNewNode } from './node-types/MyNewNode';

export const nodeComponentRegistry: Record<string, React.FC<NodeComponentProps>> = {
  'chat-input': ChatInputNode,
  'my-new-node': MyNewNode,  // ← Add this line
};
```

### Step 3: Export from Barrel File (Optional)

```typescript
// In node-types/index.ts
export { ChatInputNode } from './ChatInputNode';
export { MyNewNode } from './MyNewNode';
```

### Step 4: That's It!

Your `NodeComponentFactory` will automatically pick up and render your new node.

## Example: InstagramTriggerNode

I've created `InstagramTriggerNode.tsx` as a complete example following this pattern. It includes:
- ✅ Standard node structure
- ✅ Custom icon and styling
- ✅ Settings dialog
- ✅ Delete functionality
- ✅ Proper TypeScript typing

## Key Interfaces

### NodeComponentProps
```typescript
export interface NodeComponentProps {
  data: any;
  selected: boolean;
  id: string;
}
```

### NodeDataWithHandlers
```typescript
export interface NodeDataWithHandlers {
  nodeType: any;
  instance: any;
  selected?: boolean;
  executing?: boolean;
  errors?: string[];
  onNodeDelete?: (nodeId: string) => void;
  onNodeUpdate?: (nodeId: string, updates: any) => void;
}
```

## Features Provided by Architecture

### ✅ Automatic Features
- **Visual Consistency**: All nodes inherit `baseNodeStyles`
- **Category Colors**: Automatic color coding via `getCategoryColor()`
- **Factory Routing**: Automatic component selection
- **Handle Rendering**: Standard input/output connection points
- **Selection States**: Visual feedback for selected nodes
- **Type Safety**: Full TypeScript support

### ✅ Shared Utilities
- **Base Styles**: Consistent look and feel
- **Color System**: Category-based theming
- **Status Icons**: Execution state indicators
- **Event Handlers**: Delete, update, execute functionality

## Best Practices

1. **Follow the Pattern**: Use `ChatInputNode.tsx` as your template
2. **Use Shared Styles**: Always extend `baseNodeStyles`
3. **Handle Events**: Implement delete and other standard actions
4. **Type Everything**: Use proper TypeScript interfaces
5. **Test Registration**: Verify your node appears in the registry
6. **Naming Convention**: Use `[Purpose][Type]Node` format

## Why This Architecture Works

- ✅ **Simple**: Easy to understand and follow
- ✅ **Consistent**: All nodes look and behave similarly
- ✅ **Extensible**: Easy to add new node types
- ✅ **Maintainable**: Shared code reduces duplication
- ✅ **Type-Safe**: Full TypeScript support
- ✅ **Scalable**: Can handle many node types

This architecture strikes the perfect balance between simplicity and functionality, making it easy to add new nodes while maintaining consistency.
