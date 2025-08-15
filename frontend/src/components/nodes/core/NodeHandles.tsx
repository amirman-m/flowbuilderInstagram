// Shared NodeHandles component for consistent input/output handles
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Tooltip } from '@mui/material';
import { NodeConfiguration } from '../../../config/nodeConfiguration';

export interface NodeHandlesProps {
  nodeId: string;
  config: NodeConfiguration;
  isConnectable?: boolean;
}

/**
 * Reusable NodeHandles component that dynamically generates input and output
 * handles based on node configuration. Provides consistent styling and tooltips.
 */
export const NodeHandles: React.FC<NodeHandlesProps> = ({
  nodeId,
  config,
  isConnectable = true
}) => {
  // Safely access ports with fallback
  const ports = config.ports;
  if (!ports) {
    return null; // No handles if no ports defined
  }
  
  const maxInputs = ports.maxInputs || 0;
  const maxOutputs = ports.maxOutputs || 0;

  // Generate input handles
  const renderInputHandles = () => {
    if (maxInputs === 0) return null;
    
    const handles = [];
    for (let i = 0; i < maxInputs; i++) {
      const handleId = `input-${i}`;
      const isRequired = ports.requiredInputs?.includes(handleId) || false;
      
      handles.push(
        <Tooltip key={handleId} title={`Input ${i + 1}${isRequired ? ' (Required)' : ''}`}>
          <Handle
            type="target"
            position={Position.Left}
            id={handleId}
            isConnectable={isConnectable}
            style={{
              top: `${((i + 1) / (maxInputs + 1)) * 100}%`,
              backgroundColor: isRequired ? '#ef4444' : '#6b7280',
              border: '2px solid white',
              width: 12,
              height: 12,
            }}
          />
        </Tooltip>
      );
    }
    return handles;
  };

  // Generate output handles
  const renderOutputHandles = () => {
    if (maxOutputs === 0) return null;
    
    const handles = [];
    for (let i = 0; i < maxOutputs; i++) {
      const handleId = `output-${i}`;
      const isRequired = ports.requiredOutputs?.includes(handleId) || false;
      
      handles.push(
        <Tooltip key={handleId} title={`Output ${i + 1}${isRequired ? ' (Required)' : ''}`}>
          <Handle
            type="source"
            position={Position.Right}
            id={handleId}
            isConnectable={isConnectable}
            style={{
              top: `${((i + 1) / (maxOutputs + 1)) * 100}%`,
              backgroundColor: isRequired ? '#10b981' : '#6b7280',
              border: '2px solid white',
              width: 12,
              height: 12,
            }}
          />
        </Tooltip>
      );
    }
    return handles;
  };

  return (
    <>
      {renderInputHandles()}
      {renderOutputHandles()}
    </>
  );
};
