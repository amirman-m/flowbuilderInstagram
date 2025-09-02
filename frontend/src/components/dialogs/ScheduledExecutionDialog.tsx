import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Tooltip,
  Slide,
  Button,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import useFlowBuilderStore from '../../store/flowBuilderStore';
import { NodeExecutionStatus } from '../../types/nodes';
import { nodeService } from '../../services/nodeService';
import { NodeExecutorFactory } from '../nodes/executors/NodeExecutorFactory';
import { ScheduledMessageNodeExecutor } from '../nodes/executors/ScheduledMessageNodeExecutor';

interface StatusMessage {
  id: string;
  content: string;
  status: NodeExecutionStatus;
  nodeId?: string;
}

interface ScheduledExecutionDialogProps {
  open: boolean;
  onClose: () => void;
  flowName: string;
  triggerNodeId: string | null;
  triggerNodeType: string | null;
  onExecute: (triggerInputs: Record<string, any>) => Promise<void>;
}

const NODE_EXECUTION_TIMEOUT_MS = 30000; // 30s per node

export const ScheduledExecutionDialog: React.FC<ScheduledExecutionDialogProps> = ({
  open,
  onClose,
  flowName,
  triggerNodeId,
  triggerNodeType,
}) => {
  const { nodes: flowNodes, edges: flowEdges } = useFlowBuilderStore();
  const [messages, setMessages] = useState<StatusMessage[]>([]);
  const [nodeExecutionOrder, setNodeExecutionOrder] = useState<string[]>([]);
  const [currentExecutingNodeIndex, setCurrentExecutingNodeIndex] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState(false);
  const runAbortRef = useRef<boolean>(false);

  const addStatus = (content: string, status: NodeExecutionStatus, nodeId?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [...prev, { id, content, status, nodeId }]);
    return id;
  };

  const updateStatus = (id: string, status: NodeExecutionStatus, content?: string) => {
    setMessages((prev) => prev.map(m => m.id === id ? { ...m, status, ...(content ? { content } : {}) } : m));
  };

  // Build execution order starting from trigger node (BFS)
  useEffect(() => {
    if (open && triggerNodeId) {
      const { nodes: currentNodes, edges: currentEdges } = useFlowBuilderStore.getState();
      if (!currentNodes.length) return;

      const executionOrder: string[] = [triggerNodeId];
      const visited = new Set<string>([triggerNodeId]);
      let frontier = [triggerNodeId];

      while (frontier.length) {
        const next: string[] = [];
        for (const nid of frontier) {
          const outgoing = currentEdges.filter((e) => e.source === nid);
          for (const e of outgoing) {
            const tgt = e.target;
            if (!visited.has(tgt)) {
              visited.add(tgt);
              executionOrder.push(tgt);
              next.push(tgt);
            }
          }
        }
        frontier = next;
      }

      setNodeExecutionOrder(executionOrder);
      setCurrentExecutingNodeIndex(-1);
      setMessages([]);
    }
  }, [open, triggerNodeId]);

  const resetNodesToPending = useCallback(() => {
    if (!nodeExecutionOrder.length) return;
    const { setNodes } = useFlowBuilderStore.getState();
    setNodes((nodes) =>
      nodes.map((node) => {
        if (nodeExecutionOrder.includes(node.id)) {
          return {
            ...node,
            data: {
              ...node.data,
              instance: {
                ...((node.data as any)?.instance || {}),
                data: {
                  ...((node.data as any)?.instance?.data || {}),
                  lastExecution: {
                    status: NodeExecutionStatus.PENDING,
                    outputs: {},
                    startedAt: new Date(),
                    metadata: {},
                  },
                },
              },
              executionStatus: NodeExecutionStatus.PENDING,
              executionResult: null,
            },
          } as any;
        }
        return node;
      })
    );
  }, [nodeExecutionOrder]);

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = NODE_EXECUTION_TIMEOUT_MS): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Execution timed out')), timeoutMs)),
    ]);
  };

  // Normalize execution results coming from executors/backend
  const isResultError = (res: any): boolean => {
    if (!res) return true;
    if (typeof res.status === 'string' && res.status.toLowerCase() === 'error') return true;
    if (res.success === false) return true;
    return false;
  };

  const getErrorText = (res: any): string => {
    const text = (res && (res.error || res.message)) || 'Node failed';
    return typeof text === 'string' ? text : 'Node failed';
  };

  const executeNode = async (nodeId: string, inputs: Record<string, any> = {}): Promise<any> => {
    const node = flowNodes.find((n) => n.id === nodeId) as any;
    if (!node) throw new Error(`Node ${nodeId} not found`);
    const flowId = parseInt(node.data?.flowId?.toString() || '0');
    if (!flowId) throw new Error('No flow ID available');

    const nodeData = node.data as any;
    const instance = nodeData?.instance;
    const nodeType = nodeData?.nodeType;

    const chipId = addStatus(`Executing ${instance?.label || nodeType?.name || 'Node'}...`, NodeExecutionStatus.RUNNING, nodeId);

    const executor = NodeExecutorFactory.createExecutor(nodeId, instance, nodeType, nodeData?.onNodeUpdate);

    let result;
    if (executor) {
      result = await withTimeout(
        executor.execute({ nodeId, flowId, inputs }),
        NODE_EXECUTION_TIMEOUT_MS
      );
    } else {
      // Include node settings so backend nodes have their configured values (e.g., Web Scraper URL)
      const settings = (instance?.data?.settings) || {};
      result = await withTimeout(
        nodeService.execution.executeNode(flowId, nodeId, inputs, settings),
        NODE_EXECUTION_TIMEOUT_MS
      );
    }

    if (isResultError(result)) {
      updateStatus(chipId, NodeExecutionStatus.ERROR, `Error: ${getErrorText(result)}`);
    } else {
      updateStatus(chipId, NodeExecutionStatus.SUCCESS, `Completed ${instance?.label || nodeType?.name || 'Node'}`);
    }

    return result;
  };

  const prepareNodeInputs = (nodeId: string, results: Record<string, any>): Record<string, any> => {
    const inputs: Record<string, any> = {};
    const incoming = flowEdges.filter((e) => e.target === nodeId);
    for (const edge of incoming) {
      const srcId = edge.source;
      const srcPortId = edge.sourceHandle || '';
      const tgtPortId = edge.targetHandle || '';

      if (results[srcId] && results[srcId].outputs) {
        const outputs = results[srcId].outputs;
        let sourceOutput: any;
        if (srcPortId && srcPortId.includes('__')) {
          const portName = srcPortId.split('__')[1];
          sourceOutput = outputs[portName];
        }
        if (sourceOutput === undefined) {
          sourceOutput = outputs.message_data || outputs.ai_response || outputs.default || outputs;
        }
        if (sourceOutput !== undefined) {
          let key = 'message_data';
          if (tgtPortId && tgtPortId.includes('__')) key = tgtPortId.split('__')[1];
          inputs[key] = sourceOutput;
        }
      }
    }
    return inputs;
  };

  const runOnceNow = async () => {
    if (!triggerNodeId) return;
    const triggerNode = flowNodes.find((n) => n.id === triggerNodeId) as any;
    const flowId = parseInt(triggerNode?.data?.flowId?.toString() || '0');
    if (!flowId) throw new Error('No flow ID available');

    if (triggerNodeType !== 'scheduled_message') {
      addStatus('Unsupported trigger type for this dialog', NodeExecutionStatus.ERROR);
      return;
    }

    resetNodesToPending();
    setIsRunning(true);
    runAbortRef.current = false;

    try {
      // Execute trigger node (scheduled_message) immediately using its settings
      const triggerInstance = triggerNode?.data?.instance;
      const triggerNodeTypeData = triggerNode?.data?.nodeType;
      const executor = NodeExecutorFactory.createExecutor(
        triggerNodeId,
        triggerInstance,
        triggerNodeTypeData,
        triggerNode?.data?.onNodeUpdate
      );

      if (!executor || !(executor instanceof ScheduledMessageNodeExecutor)) {
        addStatus('Failed to initialize scheduled trigger executor', NodeExecutionStatus.ERROR);
        setIsRunning(false);
        return;
      }

      const scheduleConfig = (executor as ScheduledMessageNodeExecutor).getScheduleConfig();
      if (!scheduleConfig) {
        addStatus('Please configure schedule settings on the Scheduled Message node first', NodeExecutionStatus.ERROR);
        setIsRunning(false);
        return;
      }

      const triggerChipId = addStatus('Executing Scheduled Message trigger…', NodeExecutionStatus.RUNNING, triggerNodeId);
      const triggerResult = await withTimeout(
        (executor as ScheduledMessageNodeExecutor).executeWithScheduleConfig(scheduleConfig, flowId),
        NODE_EXECUTION_TIMEOUT_MS
      );
      if (isResultError(triggerResult)) {
        updateStatus(triggerChipId, NodeExecutionStatus.ERROR, `Error: ${getErrorText(triggerResult)}`);
        throw new Error(getErrorText(triggerResult));
      }
      updateStatus(triggerChipId, NodeExecutionStatus.SUCCESS, 'Scheduled Message trigger completed');

      // Seed results with trigger output
      const results: Record<string, any> = {};
      results[triggerNodeId] = triggerResult;

      // Execute downstream nodes sequentially
      for (let i = 1; i < nodeExecutionOrder.length; i++) {
        if (runAbortRef.current) break;
        setCurrentExecutingNodeIndex(i);
        const nodeId = nodeExecutionOrder[i];
        const nodeInputs = prepareNodeInputs(nodeId, results);
        const nodeResult = await executeNode(nodeId, nodeInputs);
        results[nodeId] = nodeResult;
        if (nodeResult && nodeResult.success === false) {
          // Continue to next nodes but mark error chip (already handled in executeNode)
          // Optionally break on first error; for now, continue to visualize all statuses
        }
      }
    } catch (err) {
      // A general error occurred; keep chips for nodes as-is and avoid adding a generic error chip
    } finally {
      setIsRunning(false);
    }
  };

  if (!open) return null;

  return (
    <Slide direction="left" in={open} mountOnEnter unmountOnExit>
      <Paper
        elevation={24}
        sx={{
          position: 'fixed',
          right: 16,
          top: 20,
          width: 380,
          height: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1300,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: '1px solid #333' }}>
          <Typography variant="subtitle1" sx={{ color: '#e0e0e0', fontWeight: 600, flex: 1 }}>
            {flowName} • Scheduled Test
          </Typography>
          <Button size="small" onClick={onClose} startIcon={<CloseIcon />} sx={{ color: '#bbb' }}>
            Close
          </Button>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
          <Typography variant="body2" sx={{ color: '#cfcfcf', mb: 2 }}>
            Click Start Test to execute the Scheduled Message trigger immediately using its configured settings and run downstream nodes.
          </Typography>
          {nodeExecutionOrder.length > 0 && currentExecutingNodeIndex >= 0 && (
            <Typography variant="caption" sx={{ color: '#9e9e9e', mb: 1, display: 'block' }}>
              Executing {currentExecutingNodeIndex + 1} / {nodeExecutionOrder.length}
            </Typography>
          )}

          <Button
            variant="contained"
            disabled={isRunning}
            onClick={runOnceNow}
            startIcon={<PlayIcon />}
            sx={{ mb: 2, borderRadius: '6px', textTransform: 'none', fontWeight: 500 }}
          >
            {isRunning ? 'Running…' : 'Start Test'}
          </Button>

          {/* Status chips */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {messages.map((m) => (
              <Box key={m.id} sx={{ display: 'flex', justifyContent: 'center' }}>
                <Tooltip title={m.content} arrow>
                  <Chip
                    icon={m.status === NodeExecutionStatus.RUNNING ? <CircularProgress size={14} sx={{ color: '#2196F3' }} /> : <PlayIcon sx={{ fontSize: 14 }} />}
                    label={m.content}
                    variant="outlined"
                    sx={{
                      backgroundColor:
                        m.status === NodeExecutionStatus.SUCCESS
                          ? 'rgba(76, 175, 80, 0.1)'
                          : m.status === NodeExecutionStatus.ERROR
                          ? 'rgba(244, 67, 54, 0.1)'
                          : 'rgba(33, 150, 243, 0.1)',
                      borderColor:
                        m.status === NodeExecutionStatus.SUCCESS
                          ? '#4CAF50'
                          : m.status === NodeExecutionStatus.ERROR
                          ? '#F44336'
                          : '#2196F3',
                      color:
                        m.status === NodeExecutionStatus.SUCCESS
                          ? '#4CAF50'
                          : m.status === NodeExecutionStatus.ERROR
                          ? '#F44336'
                          : '#2196F3',
                      fontSize: '12px',
                      height: '28px',
                      maxWidth: 320,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      '& .MuiChip-icon': {
                        color:
                          m.status === NodeExecutionStatus.SUCCESS
                            ? '#4CAF50'
                            : m.status === NodeExecutionStatus.ERROR
                            ? '#F44336'
                            : '#2196F3',
                      },
                    }}
                  />
                </Tooltip>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>
    </Slide>
  );
};
