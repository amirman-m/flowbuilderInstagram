// Compact Node Container - SOLID-compliant container component for modern nodes
// Follows the established architecture pattern with presenter separation

import React from 'react';
import { NodeComponentProps } from '../registry';
import { CompactNodePresentation } from './CompactNodePresentation';
import { useCompactNodePresenter } from '../hooks/useCompactNodePresenter';
import { NodeExecutionService, ExecutionContext } from '../../../services/NodeExecutionService';

export interface CompactNodeContainerProps extends NodeComponentProps {
  customColorName?: string;
  showExecuteButton?: boolean;
  showDeleteButton?: boolean;
  onCustomExecute?: () => void;
}

export const CompactNodeContainer: React.FC<CompactNodeContainerProps> = ({
  id,
  data,
  customColorName,
  showExecuteButton = true,
  showDeleteButton = true,
  onCustomExecute
}) => {
  const { nodeType, instance, onNodeUpdate, onNodeDelete } = data;

  // Use compact node presenter hook
  const { presentationData, handleExecute, handleDelete } = useCompactNodePresenter({
    nodeId: id,
    nodeType,
    customColorName,
    onExecute: async () => {
      if (onCustomExecute) {
        onCustomExecute();
      } else {
        // Use centralized execution service
        const executionService = NodeExecutionService.getInstance();
        const executionContext: ExecutionContext = {
          nodeId: id,
          flowId: 0, // TODO: Get actual flow ID
          settings: instance?.data?.settings || {},
          inputs: instance?.data?.inputs || {}
        };
        await executionService.executeNode(executionContext, onNodeUpdate);
      }
    },
    onDelete: () => {
      if (onNodeDelete) {
        onNodeDelete(id);
      }
    }
  });

  // Extract port information from nodeType
  const inputPorts = nodeType?.ports?.inputs?.map(port => ({
    id: port.id,
    name: port.name,
    label: port.label
  })) || [];
  
  const outputPorts = nodeType?.ports?.outputs?.map(port => ({
    id: port.id,
    name: port.name,
    label: port.label
  })) || [];

  return (
    <CompactNodePresentation
      nodeName={presentationData.nodeName}
      nodeIcon={presentationData.nodeIcon}
      colorName={presentationData.colorName}
      executionStatus={presentationData.executionStatus}
      isExecuting={presentationData.isExecuting}
      onExecute={handleExecute}
      onDelete={handleDelete}
      inputPorts={inputPorts}
      outputPorts={outputPorts}
      showExecuteButton={showExecuteButton && presentationData.showExecuteButton}
      showDeleteButton={showDeleteButton && presentationData.showDeleteButton}
      disabled={presentationData.disabled}
    />
  );
};
