import React from 'react';
import { NodeInstance, NodeType } from '../../../types/nodes';
import BaseNodePresentation from './BaseNodePresentation';
import { useNodePresenter } from '../hooks/useNodePresenter';

export interface BaseNodeProps {
  id: string;
  instance: NodeInstance;
  nodeType: NodeType;
  selected?: boolean;
  children?: React.ReactNode;
  customHeader?: React.ReactNode;
  customContent?: React.ReactNode;
  customFooter?: React.ReactNode;
  hideDefaultContent?: boolean;
  onExecute?: () => void;
  onRefresh?: () => void;
  onDelete?: () => void;
  onSettings?: () => void;
  onSettingsClick?: () => void;
  onNodeUpdate?: (updates: Partial<NodeInstance>) => void;
}

const BaseNode: React.FC<BaseNodeProps> = ({
  id,
  instance,
  nodeType,
  selected = false,
  children,
  customHeader,
  customContent,
  customFooter,
  hideDefaultContent = false,
  onExecute,
  onRefresh,
  onDelete,
  onSettings,
  onSettingsClick,
  onNodeUpdate
}) => {
  // Use the presenter hook for business logic
  const { presentationData, inputPorts, outputPorts } = useNodePresenter({
    nodeId: id,
    instance,
    nodeType,
    selected,
    onExecute,
    onRefresh,
    onDelete,
    onNodeUpdate
  });

  // Pure presentation component
  return (
    <BaseNodePresentation
      presentationData={presentationData}
      inputPorts={inputPorts}
      outputPorts={outputPorts}
      nodeTypeId={nodeType?.id}
      customHeader={customHeader}
      customContent={customContent}
      customFooter={customFooter}
      hideDefaultContent={hideDefaultContent}
      onSettingsClick={onSettings || onSettingsClick}
    >
      {children}
    </BaseNodePresentation>
  );
};

BaseNode.displayName = 'BaseNode';

export default BaseNode;
