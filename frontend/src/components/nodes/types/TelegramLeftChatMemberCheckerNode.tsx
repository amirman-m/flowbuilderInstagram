import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { useExecutionData } from '../hooks';

/**
 * TelegramLeftChatMemberCheckerNode - A processor node that checks Telegram webhook data for user leave events
 * Routes input to 'true' output if user leave detected, 'false' output otherwise
 * Shows colored labels next to each output port similar to SwitchInputTypeNode
 */
export const TelegramLeftChatMemberCheckerNode: React.FC<NodeComponentProps> = (props) => {
  const { data } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType } = nodeData;
  
  // Use execution data hook to get fresh execution results
  const executionData = useExecutionData(nodeData);
  
  // Get output ports for label rendering with sensible defaults
  const outputPorts = (nodeType?.ports?.outputs && nodeType.ports.outputs.length > 0)
    ? nodeType.ports.outputs.map((p: any) => ({
        id: p.id,
        name: p.name,
        // Force concise labels for true/false for better visibility
        label: p.id === 'true' ? 'Leave' : (p.id === 'false' ? 'Not Leave' : (p.name || ''))
      }))
    : [
        { id: 'true', name: 'true', label: 'Leave' },
        { id: 'false', name: 'false', label: 'Not Leave' }
      ];

  // Custom content for execution display
  const renderCustomContent = () => (
    <>
      {/* Execution Results Display */}
      {executionData.displayData && (
        <Box sx={{
          mt: 0.75,
          p: 1,
          width: '100%',
          backgroundColor: '#f5f5f5',
          borderRadius: 1,
          border: '1px solid #ddd'
        }}>
          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#666' }}>
            {executionData.status === 'running' ? 'Status:' : 'Check result:'}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.75rem',
              color: '#333',
              display: 'block',
              mt: 0.5,
              wordBreak: 'break-word'
            }}
          >
            {(() => {
              const { displayData } = executionData;
              if (executionData.status === 'running') {
                return 'Checking for user leave events...';
              }
              
              // Check if we have group event information in the metadata
              const metadata = (displayData as any)?.metadata;
              const groupEventCheck = metadata?.group_event_check;
              
              if (groupEventCheck) {
                const isUserLeave = groupEventCheck.is_user_leave;
                const leaveDetails = groupEventCheck.leave_details || [];
                
                if (isUserLeave && leaveDetails.length > 0) {
                  const usernames = leaveDetails.map((detail: any) => 
                    detail.username || detail.first_name || 'Unknown'
                  ).join(', ');
                  return `🚪 User leave detected: ${usernames} (routed to TRUE)`;
                } else if (isUserLeave) {
                  return `🚪 User leave detected (routed to TRUE)`;
                } else {
                  return `❌ No user leave detected (routed to FALSE)`;
                }
              }
              
              // Fallback display
              if (executionData.outputs) {
                if (executionData.outputs.true) {
                  return '🚪 User leave event detected (routed to TRUE)';
                } else if (executionData.outputs.false) {
                  return '❌ No user leave event (routed to FALSE)';
                }
              }
              
              return 'No execution data available';
            })()}
          </Typography>
        </Box>
      )}

      {/* Status indicators */}
      {executionData.status === 'running' && (
        <Alert
          severity="info"
          sx={{ mt: 0.75, fontSize: '0.75rem', width: '100%' }}
        >
          <Typography variant="caption">
            🔄 Checking Telegram message for user leave events...
          </Typography>
        </Alert>
      )}
      
      {/* Success indicator */}
      {executionData.hasFreshResults && executionData.isSuccess && executionData.status !== 'running' && (
        <Alert
          severity="success"
          icon={<CheckCircleIcon />}
          sx={{ mt: 0.75, fontSize: '0.75rem', width: '100%' }}
        >
          <Typography variant="caption">
            User leave check completed successfully
            {executionData.executionTime && ` in ${executionData.executionTime.toFixed(2)}ms`}
          </Typography>
        </Alert>
      )}

      {/* Error indicator */}
      {executionData.hasFreshResults && executionData.isError && (
        <Alert
          severity="error"
          icon={<ErrorIcon />}
          sx={{ mt: 0.75, fontSize: '0.75rem', width: '100%' }}
        >
          <Typography variant="caption">
            Execution failed: {executionData.outputs?.error || 'Unknown error'}
          </Typography>
        </Alert>
      )}
    </>
  );

  return (
    <Box sx={{ position: 'relative', width: 280, height: 'fit-content', overflow: 'visible' }}>
      {/* Core node UI */}
      <CompactNodeContainer
        {...props}
        customColorName="violet"
        outputHandleGradientMap={{
          'true': 'linear-gradient(135deg, #ef4444, #b91c1c)',
          'false': 'linear-gradient(135deg, #10b981, #059669)'
        }}
        showExecuteButton={true}
        showDeleteButton={true}
      />

      {/* Custom content with status indicators */}
      <Box sx={{ width: '100%' }}>
        {renderCustomContent()}
      </Box>

      {/* Overlay: non-interactive port labels aligned with handles */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10002,
          overflow: 'visible',
        }}
      >
        {/* Output labels (right) - positioned outside the node, aligned with handles */}
        {outputPorts.map((port: any, index: number) => {
          const topPercent = ((index + 1) / (outputPorts.length + 1)) * 100;
          const text = (port.label || port.name) as string;
          const tl = text.toLowerCase();
          
          // Determine background color based on port name
          let bgColor = '#1e293b'; // default dark slate
          let borderColor = '#334155';
          
          // Important: prioritize explicit false/not before generic leave/true
          if (port.id === 'false' || tl.includes('false') || tl.includes('not')) {
            bgColor = '#065f46'; // green for false/not leave (normal state)
            borderColor = '#059669';
          } else if (port.id === 'true' || tl.includes('true') || tl.includes('leave')) {
            bgColor = '#7f1d1d'; // deep red for true/leave
            borderColor = '#ef4444';
          }
          
          return (
            <Box
              key={`output-label-${port.id}`}
              sx={{
                position: 'absolute',
                left: 'calc(100% + 12px)', // position right after the handle
                top: `${topPercent}%`,
                transform: 'translateY(-50%)', // center with the handle
                backgroundColor: bgColor,
                color: '#ffffff',
                border: `1px solid ${borderColor}`,
                padding: '2px 5px',
                fontSize: '10px',
                fontWeight: 600,
                lineHeight: 1.2,
                textAlign: 'left',
                minWidth: 0,
                maxWidth: 64,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                borderRadius: '3px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
              title={text}
            >
              {text}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
