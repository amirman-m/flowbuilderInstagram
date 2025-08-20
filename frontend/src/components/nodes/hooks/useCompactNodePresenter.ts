// Compact Node Presenter Hook - React integration for modern compact nodes
// SOLID-compliant hook following the established architecture pattern

import React, { useState, useEffect, useCallback } from 'react';
import { NodeType, NodeExecutionStatus } from '../../../types/nodes';
import { NodeExecutionManager } from '../core/NodeExecutionManager';
import { nodeColorService } from '../../../services/NodeColorService';
import { NODE_ICONS } from '../../../config/nodeIcons';

export interface CompactNodePresentationData {
  // Node identification
  nodeId: string;
  nodeName: string;
  nodeIcon: React.ReactNode;
  colorName: string;
  
  // Execution state
  executionStatus: NodeExecutionStatus;
  isExecuting: boolean;
  
  // Configuration
  showExecuteButton: boolean;
  showDeleteButton: boolean;
  disabled: boolean;
}

export interface UseCompactNodePresenterProps {
  nodeId: string;
  nodeType: NodeType;
  onExecute?: () => void;
  onDelete?: () => void;
  customColorName?: string;
}

export interface UseCompactNodePresenterReturn {
  presentationData: CompactNodePresentationData;
  handleExecute: () => void;
  handleDelete: () => void;
  setColorName: (colorName: string) => void;
}

export const useCompactNodePresenter = ({
  nodeId,
  nodeType,
  onExecute,
  onDelete,
  customColorName
}: UseCompactNodePresenterProps): UseCompactNodePresenterReturn => {
  const [executionStatus, setExecutionStatus] = useState<NodeExecutionStatus>(NodeExecutionStatus.PENDING);
  const [isExecuting, setIsExecuting] = useState(false);
  const [colorName, setColorNameState] = useState<string>(
    customColorName || nodeColorService.getNodeColorName(nodeId)
  );

  // Subscribe to execution status changes
  useEffect(() => {
    const executionManager = NodeExecutionManager.getInstance();
    
    const unsubscribe = executionManager.subscribe(nodeId, (_, state) => {
      setExecutionStatus(state.status);
      setIsExecuting(state.status === NodeExecutionStatus.RUNNING);
    });

    // Initialize with current status
    const currentStatus = executionManager.getStatus(nodeId);
    setExecutionStatus(currentStatus);
    setIsExecuting(currentStatus === NodeExecutionStatus.RUNNING);

    return unsubscribe;
  }, [nodeId]);

  // Update color service when color changes
  useEffect(() => {
    if (customColorName) {
      nodeColorService.setNodeColor(nodeId, customColorName);
      setColorNameState(customColorName);
    }
  }, [nodeId, customColorName]);

  // Handle execute action
  const handleExecute = useCallback(() => {
    if (onExecute) {
      onExecute();
    }
  }, [onExecute]);

  // Handle delete action
  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete();
    }
  }, [onDelete]);

  // Handle color change
  const setColorName = useCallback((newColorName: string) => {
    nodeColorService.setNodeColor(nodeId, newColorName);
    setColorNameState(newColorName);
  }, [nodeId]);

  // Get node icon
  const getNodeIcon = () => {
    const IconComponent = NODE_ICONS[nodeType?.id || 'default'] || NODE_ICONS['default'];
    return React.createElement(IconComponent, { sx: { fontSize: 14 } });
  };

  // Build presentation data
  const presentationData: CompactNodePresentationData = {
    nodeId,
    nodeName: nodeType?.name || 'Unknown Node',
    nodeIcon: getNodeIcon(),
    colorName,
    executionStatus,
    isExecuting,
    showExecuteButton: true,
    showDeleteButton: true,
    disabled: false
  };

  return {
    presentationData,
    handleExecute,
    handleDelete,
    setColorName
  };
};
