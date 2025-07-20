// src/components/nodes/NodeComponentFactory.tsx
import React from 'react';
import { NodeProps } from '@xyflow/react';
import { getNodeComponent, DefaultNode } from './registry';
import { FlowNode } from '../../types/nodes';

export const NodeComponentFactory: React.FC<NodeProps> = (props) => {
  const { data } = props;
  
  // Ensure we have valid data
  if (!data || !data.nodeType) {
    console.warn('NodeComponentFactory: Invalid node data', data);
    return <DefaultNode {...props} />;
  }
  
  const nodeData = data as FlowNode['data'];
  const nodeTypeId = nodeData.nodeType.id;
  
  if (!nodeTypeId) {
    console.warn('NodeComponentFactory: Missing nodeTypeId', nodeData);
    return <DefaultNode {...props} />;
  }
  
  // Get the appropriate component for this node type
  const NodeComponent = getNodeComponent(nodeTypeId);
  return <NodeComponent {...props} />;
};