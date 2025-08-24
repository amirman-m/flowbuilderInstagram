import { useState, useEffect, useMemo, useCallback } from 'react';
import { NodeInstance, NodeType, NodeExecutionStatus } from '../../../types/nodes';
import { NodePresenter, NodePresentationData } from '../core/NodePresenter';
import { useExecutionData } from './useExecutionData';

interface UseNodePresenterProps {
  nodeId: string;
  instance: NodeInstance;
  nodeType: NodeType;
  selected?: boolean;
  onExecute?: () => void;
  onRefresh?: () => void;
  onDelete?: () => void;
  onNodeUpdate?: (updates: Partial<NodeInstance>) => void;
}

export const useNodePresenter = ({
  nodeId,
  instance,
  nodeType,
  selected = false,
  onExecute,
  onRefresh,
  onDelete,
  onNodeUpdate
}: UseNodePresenterProps) => {
  // UI state
  const [isHovered, setIsHovered] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // Execution data
  const executionData = useExecutionData({ id: nodeId } as any);
  
  // Create presenter instance
  const presenter = useMemo(() => {
    return new NodePresenter(nodeId, instance, nodeType, {
      onExecute,
      onRefresh,
      onDelete,
      onNodeUpdate
    });
  }, [nodeId, instance, nodeType, onExecute, onRefresh, onDelete, onNodeUpdate]);
  
  // Execution status state
  const [executionStatus, setExecutionStatus] = useState<NodeExecutionStatus>(
    presenter.getExecutionStatus()
  );
  const [statusMessage, setStatusMessage] = useState<string | undefined>(
    presenter.getStatusMessage()
  );
  
  // Subscribe to execution status changes
  useEffect(() => {
    const unsubscribe = presenter.subscribeToStatus((status, message) => {
      setExecutionStatus(status);
      setStatusMessage(message);
      
      // Show success animation
      if (status === NodeExecutionStatus.SUCCESS) {
        setShowSuccessAnimation(true);
        const timer = setTimeout(() => setShowSuccessAnimation(false), 2000);
        return () => clearTimeout(timer);
      }
    });
    
    return unsubscribe;
  }, [presenter]);
  
  // Handle hover with presenter
  const handleHover = useCallback((hovered: boolean) => {
    setIsHovered(hovered);
    presenter.handleHover(hovered);
  }, [presenter]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      presenter.dispose();
    };
  }, [presenter]);
  
  // Build presentation data
  const presentationData: NodePresentationData = useMemo(() => ({
    isHovered,
    isExecuting: presenter.isExecuting(),
    showSuccessAnimation,
    selected,
    executionStatus,
    statusMessage,
    executionData,
    safeConfig: presenter.getSafeConfig(),
    gradient: presenter.getGradient(),
    handleExecute: presenter.handleExecute,
    handleRefresh: presenter.handleRefresh,
    handleDelete: presenter.handleDelete,
    handleHover
  }), [
    isHovered,
    presenter,
    showSuccessAnimation,
    selected,
    executionStatus,
    statusMessage,
    executionData,
    handleHover
  ]);
  
  // Port data
  const inputPorts = useMemo(() => presenter.getInputPorts(), [presenter]);
  const outputPorts = useMemo(() => presenter.getOutputPorts(), [presenter]);
  
  return {
    presentationData,
    inputPorts,
    outputPorts,
    presenter
  };
};
