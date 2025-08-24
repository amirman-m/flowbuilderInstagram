// Compact Node Container - SOLID-compliant container component for modern nodes
// Follows the established architecture pattern with presenter separation

import React from 'react';
import { NodeComponentProps } from '../registry';
import { CompactNodePresentation } from './CompactNodePresentation';
import { useCompactNodePresenter } from '../hooks/useCompactNodePresenter';
import { NodeExecutionService, ExecutionContext } from '../../../services/NodeExecutionService';
import type { ExecutionResult } from '../../../services/NodeExecutionService';
import { useParams } from 'react-router-dom';
import { useNodeInputs } from '../hooks/useNodeInputs';
import { NodeExecutionStatus } from '../../../types/nodes';
import { NodeExecutionManager } from './NodeExecutionManager';
import { useRequiredInputsGuard } from '../hooks/useRequiredInputsGuard';

export interface CompactNodeContainerProps extends NodeComponentProps {
  customColorName?: string;
  showExecuteButton?: boolean;
  showDeleteButton?: boolean;
  onCustomExecute?: () => void;
  onBeforeExecute?: () => Promise<boolean> | boolean;
}

export const CompactNodeContainer: React.FC<CompactNodeContainerProps> = ({
  id,
  data,
  customColorName,
  showExecuteButton = true,
  showDeleteButton = true,
  onCustomExecute,
  onBeforeExecute
}) => {
  const { nodeType, instance, onNodeUpdate, onNodeDelete } = data;

  // Derive flowId: prefer provided data.flowId, fallback to URL param
  const { flowId: routeFlowId } = useParams<{ flowId: string }>();
  const parsedFlowId = Number(data?.flowId ?? routeFlowId);
  const effectiveFlowId = Number.isFinite(parsedFlowId) && parsedFlowId > 0 ? parsedFlowId : 1;

  // Inputs collector from connected upstream nodes
  const { collectInputs } = useNodeInputs(id);

  // Guard: ensure required input ports are connected before execution
  const { assertOrNotify } = useRequiredInputsGuard(id, nodeType);

  // Initialize execution status from backend-provided data when node mounts or data updates
  React.useEffect(() => {
    const mgr = NodeExecutionManager.getInstance();

    // Prefer instance.data.lastExecution.status if available
    const beLastExec = (instance?.data as any)?.lastExecution as
      | { status?: string | NodeExecutionStatus }
      | undefined;

    // Fallbacks occasionally present on data for legacy nodes
    const beStatus = (data as any)?.executionStatus || (data as any)?.status;

    let initialStatus: NodeExecutionStatus | null = null;

    const normalize = (s: any): NodeExecutionStatus | null => {
      if (!s) return null;
      if (typeof s !== 'string') return s as NodeExecutionStatus;
      switch (s.toLowerCase()) {
        case 'success':
          return NodeExecutionStatus.SUCCESS;
        case 'running':
          return NodeExecutionStatus.RUNNING;
        case 'error':
        case 'failed':
          return NodeExecutionStatus.ERROR;
        case 'skipped':
          return NodeExecutionStatus.SKIPPED;
        case 'pending':
        default:
          return NodeExecutionStatus.PENDING;
      }
    };

    initialStatus = normalize(beLastExec?.status) || normalize(beStatus);

    if (initialStatus && mgr.getStatus(id) === NodeExecutionStatus.PENDING && initialStatus !== NodeExecutionStatus.PENDING) {
      mgr.setStatus(id, initialStatus, 'Initialized from backend');
    }
  }, [id, instance?.data?.lastExecution?.status, (data as any)?.executionStatus, (data as any)?.status]);

  // Bridge to adapt ExecutionResult -> NodeData.NodeExecutionResult
  const onExecCompleteBridge = data?.onExecutionComplete
    ? (nodeId: string, result: ExecutionResult) => {
        const mapped = {
          status: result.status,
          outputs: (result.outputs ?? {}) as Record<string, unknown>,
          error: result.error,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          metadata: result.metadata,
          success: result.success,
          timestamp: result.completedAt,
        };
        data.onExecutionComplete?.(nodeId, mapped as any);
      }
    : undefined;

  // Use compact node presenter hook
  const { presentationData, handleExecute, handleDelete } = useCompactNodePresenter({
    nodeId: id,
    nodeType,
    customColorName,
    onExecute: async () => {
      // Optional guard from node component: can cancel execution
      if (onBeforeExecute) {
        const proceed = await onBeforeExecute();
        if (!proceed) return;
      }

      // Validate required input connections before executing
      const inputsOk = assertOrNotify();
      if (!inputsOk) {
        return;
      }
      if (onCustomExecute) {
        onCustomExecute();
      } else {
        // Use centralized execution service
        const executionService = NodeExecutionService.getInstance();
        const executionContext: ExecutionContext = {
          nodeId: id,
          flowId: effectiveFlowId,
          settings: instance?.data?.settings || {},
          inputs: instance?.data?.inputs || {}
        };
        await executionService.executeNode(
          executionContext,
          onNodeUpdate,
          onExecCompleteBridge,
          collectInputs
        );
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
