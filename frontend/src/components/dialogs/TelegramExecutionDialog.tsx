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
import nodeService from '../../services/nodeService';
import { NodeExecutorFactory } from '../nodes/executors/NodeExecutorFactory';

// Minimal message type for status display
interface StatusMessage {
  id: string;
  content: string;
  status: NodeExecutionStatus;
}

interface TelegramExecutionDialogProps {
  open: boolean;
  onClose: () => void;
  flowName: string;
  triggerNodeId: string | null;
  triggerNodeType: string | null;
  onExecute: (triggerInputs: Record<string, any>) => Promise<void>;
}

const EXECUTION_TIMEOUT_MS = 60000; // 60 seconds
const NODE_EXECUTION_TIMEOUT_MS = 30000; // 30 seconds per node

// API base URL (align with TelegramInputNode.tsx behavior)
const API_BASE_URL = (() => {
  const apiPath = '/api/v1';
  const envUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  if (envUrl && !envUrl.includes('localhost')) {
    const base = envUrl.replace(/\/$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }
  return apiPath;
})();

export const TelegramExecutionDialog: React.FC<TelegramExecutionDialogProps> = ({
  open,
  onClose,
  flowName,
  triggerNodeId,
  triggerNodeType,
  onExecute,
}) => {
  const { nodes: flowNodes, edges: flowEdges } = useFlowBuilderStore();
  const [messages, setMessages] = useState<StatusMessage[]>([]);
  const [nodeExecutionOrder, setNodeExecutionOrder] = useState<string[]>([]);
  const [currentExecutingNodeIndex, setCurrentExecutingNodeIndex] = useState<number>(-1);
  const [isListening, setIsListening] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Helper to add status message chip
  const addStatus = (content: string, status: NodeExecutionStatus) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [...prev, { id, content, status }]);
    return id;
  };

  // Build execution order when dialog opens
  useEffect(() => {
    if (open && triggerNodeId) {
      const { nodes: currentNodes, edges: currentEdges } = useFlowBuilderStore.getState();
      if (!currentNodes.length || !currentEdges.length) return;

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
    }
  }, [open, triggerNodeId]);

  // Reset nodes to PENDING when starting run
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

  // Execute a single node via NodeExecutorFactory
  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = NODE_EXECUTION_TIMEOUT_MS): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Execution timed out')), timeoutMs)),
    ]);
  };

  const executeNode = async (nodeId: string, inputs: Record<string, any> = {}): Promise<any> => {
    const node = flowNodes.find((n) => n.id === nodeId) as any;
    if (!node) throw new Error(`Node ${nodeId} not found`);
    const flowId = parseInt(node.data?.flowId?.toString() || '0');
    if (!flowId) throw new Error('No flow ID available');

    const nodeData = node.data as any;
    const instance = nodeData?.instance;
    const nodeType = nodeData?.nodeType;

    // Add running status chip
    addStatus(`Executing ${instance?.label || nodeType?.name || 'Node'}...`, NodeExecutionStatus.RUNNING);

    const executor = NodeExecutorFactory.createExecutor(nodeId, instance, nodeType, nodeData?.onNodeUpdate);

    let result;
    if (executor) {
      result = await withTimeout(
        executor.execute({ nodeId, flowId, inputs }),
        NODE_EXECUTION_TIMEOUT_MS
      );
    } else {
      result = await withTimeout(
        nodeService.execution.executeNode(flowId, nodeId, inputs),
        NODE_EXECUTION_TIMEOUT_MS
      );
    }

    return result;
  };

  // Prepare inputs for a node from prior results
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

  // Start SSE listening and then run downstream nodes when a message arrives
  const startListeningAndRun = async () => {
    if (!triggerNodeId) return;
    const triggerNode = flowNodes.find((n) => n.id === triggerNodeId) as any;
    const flowId = parseInt(triggerNode?.data?.flowId?.toString() || '0');
    if (!flowId) throw new Error('No flow ID available');

    resetNodesToPending();

    // Optionally ensure trigger configured by running it once without inputs
    try {
      const nodeTypeId = triggerNode?.data?.nodeType?.id;
      if (nodeTypeId === 'telegram_input') {
        const executor = NodeExecutorFactory.createExecutor(
          triggerNodeId,
          triggerNode?.data?.instance,
          triggerNode?.data?.nodeType,
          triggerNode?.data?.onNodeUpdate
        );
        if (executor) {
          await withTimeout(executor.execute({ nodeId: triggerNodeId, flowId, inputs: {} }), 15000);
        }
      }
    } catch (e) {
      // non-fatal; continue to listen
    }

    setIsListening(true);

    const es = new EventSource(`${API_BASE_URL}/telegram/listen/${flowId}`, { withCredentials: true } as any);
    eventSourceRef.current = es;

    es.onopen = () => {
      addStatus('Listening for Telegram messages...', NodeExecutionStatus.RUNNING);
    };

    es.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'telegram_message') {
          const messageData = (payload.outputs || {}).message_data || {};

          // Seed trigger outputs locally and execute downstream nodes
          setIsRunning(true);
          setCurrentExecutingNodeIndex(1);
          const results: Record<string, any> = {};
          results[triggerNodeId] = {
            success: true,
            status: NodeExecutionStatus.SUCCESS,
            outputs: { message_data: messageData },
          };

          // Execute remaining nodes
          for (let i = 1; i < nodeExecutionOrder.length; i++) {
            setCurrentExecutingNodeIndex(i);
            const nodeId = nodeExecutionOrder[i];
            const nodeInputs = prepareNodeInputs(nodeId, results);
            const nodeResult = await executeNode(nodeId, nodeInputs);
            results[nodeId] = nodeResult;
            if (nodeResult && nodeResult.success === false) {
              throw new Error(typeof nodeResult?.message === 'string' ? nodeResult.message : 'Node failed');
            }
          }

          setIsRunning(false);
          addStatus('Flow execution complete', NodeExecutionStatus.SUCCESS);
          es.close();
          setIsListening(false);
        } else if (payload.type === 'timeout') {
          addStatus('Timeout: No message received in 60 seconds', NodeExecutionStatus.ERROR);
          es.close();
          setIsListening(false);
        }
      } catch (err) {
        addStatus('Stream error while processing message', NodeExecutionStatus.ERROR);
        es.close();
        setIsListening(false);
      }
    };

    es.onerror = () => {
      addStatus('SSE connection error', NodeExecutionStatus.ERROR);
      es.close();
      setIsListening(false);
    };

    // Safety timeout
    setTimeout(() => {
      if (eventSourceRef.current && (eventSourceRef.current as any).readyState !== 2) {
        addStatus('Execution timed out', NodeExecutionStatus.ERROR);
        try { eventSourceRef.current.close(); } catch {}
        setIsListening(false);
      }
    }, EXECUTION_TIMEOUT_MS);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        try { eventSourceRef.current.close(); } catch {}
        eventSourceRef.current = null;
      }
    };
  }, []);

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
            {flowName} • Telegram
          </Typography>
          <Button size="small" onClick={onClose} startIcon={<CloseIcon />} sx={{ color: '#bbb' }}>
            Close
          </Button>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
          <Typography variant="body2" sx={{ color: '#cfcfcf', mb: 2 }}>
            Click Start to listen for a Telegram message. When a message arrives, the flow will run automatically.
          </Typography>

          {/* Action button */}
          <Button
            variant="contained"
            disabled={isListening || isRunning}
            onClick={startListeningAndRun}
            startIcon={<PlayIcon />}
            sx={{ mb: 2, borderRadius: '6px', textTransform: 'none', fontWeight: 500 }}
          >
            {isListening ? 'Listening…' : isRunning ? 'Running…' : 'Start'}
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
