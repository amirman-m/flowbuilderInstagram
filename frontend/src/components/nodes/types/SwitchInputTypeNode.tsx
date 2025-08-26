import React from 'react';
import { Box } from '@mui/material';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { NodeComponentProps } from '../registry';

/**
 * SwitchInputTypeNode - A node that routes input to different outputs based on content type
 * Shows colored labels next to each output port for better UX
 */
export const SwitchInputTypeNode: React.FC<NodeComponentProps> = (props) => {
  const outputPorts = props.data?.nodeType?.ports?.outputs ?? [];

  return (
    <Box sx={{ position: 'relative', width: 'fit-content', height: 'fit-content', overflow: 'visible' }}>
      {/* Core node UI */}
      <CompactNodeContainer
        {...props}
        customColorName="coral"
        showExecuteButton={true}
        showDeleteButton={true}
      />

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
          const text = port.label || port.name;
          
          // Determine background color based on port name
          let bgColor = '#1e293b'; // default dark slate
          let borderColor = '#334155';
          
          if (text.toLowerCase().includes('text')) {
            bgColor = '#065f46'; // dark green
            borderColor = '#059669';
          } else if (text.toLowerCase().includes('voice')) {
            bgColor = '#6d28d9'; // purple
            borderColor = '#7c3aed';
          } else if (text.toLowerCase().includes('other')) {
            bgColor = '#c2410c'; // orange/amber
            borderColor = '#ea580c';
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
}
