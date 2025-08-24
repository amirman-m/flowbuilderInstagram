import { useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { NodeType, NodeExecutionStatus } from '../../../types/nodes';
import { NodeExecutionManager } from '../core/NodeExecutionManager';
import { showAppSnackbar } from '../../SnackbarProvider';

export interface RequiredInputsValidation {
  isValid: boolean;
  missingPortIds: string[];
  message?: string;
}

/**
 * Validate that all required input ports have at least one incoming connection.
 * - Modular and reusable across node types
 * - Uses React Flow edges to determine connectivity
 */
export function useRequiredInputsGuard(nodeId: string, nodeType?: NodeType) {
  const { getEdges } = useReactFlow();

  const requiredInputPortIds = useMemo(() => {
    return (nodeType?.ports?.inputs || [])
      .filter(p => p.required)
      .map(p => p.id);
  }, [nodeType]);

  const validate = useCallback((): RequiredInputsValidation => {
    const edges = getEdges();

    // Map: targetPortId -> hasIncoming
    const incomingByPort = new Map<string, boolean>();
    requiredInputPortIds.forEach(pid => incomingByPort.set(pid, false));

    for (const edge of edges) {
      if (edge.target !== nodeId) continue;
      const targetPort = edge.targetHandle || 'default';
      if (incomingByPort.has(targetPort)) {
        incomingByPort.set(targetPort, true);
      }
    }

    const missingPortIds = Array.from(incomingByPort.entries())
      .filter(([, hasIncoming]) => !hasIncoming)
      .map(([pid]) => pid);

    if (missingPortIds.length > 0) {
      const portLabels = (nodeType?.ports?.inputs || [])
        .filter(p => missingPortIds.includes(p.id))
        .map(p => p.label || p.name || p.id);

      const message = `Connection required: Please connect ${portLabels.join(', ')} input${portLabels.length > 1 ? 's' : ''}.`;

      return { isValid: false, missingPortIds, message };
    }

    return { isValid: true, missingPortIds: [] };
  }, [getEdges, nodeId, nodeType?.ports?.inputs, requiredInputPortIds]);

  const assertOrNotify = useCallback(() => {
    const result = validate();
    if (!result.isValid) {
      // Update centralized status as skipped with message
      NodeExecutionManager.getInstance().setStatus(
        nodeId,
        NodeExecutionStatus.SKIPPED,
        result.message || 'Missing required input connection.'
      );

      // Notify via global snackbar (UX-friendly)
      if (result.message) {
        showAppSnackbar({ message: result.message, severity: 'error', duration: 5000 });
      }

      return false;
    }
    return true;
  }, [nodeId, validate]);

  return { validate, assertOrNotify };
}
