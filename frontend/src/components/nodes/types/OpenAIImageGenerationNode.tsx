import React from 'react';
import { Box, Alert, Chip } from '@mui/material';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';

/**
 * OpenAIImageGenerationNode - A node that generates images using OpenAI's image generation API
 * Supports DALL-E 2, DALL-E 3, and GPT-Image-1 models with comprehensive configuration
 */
export const OpenAIImageGenerationNode: React.FC<NodeComponentProps> = (props) => {
  const { data } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;

  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete,
  });

  const inputPorts = props.data?.nodeType?.ports?.inputs ?? [];

  // Map input handles to colors: prompt = purple (AI/text related)
  const inputHandleGradientMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    inputPorts.forEach((port: any) => {
      const text = (port.label || port.name || '').toString().toLowerCase();
      if (text.includes('prompt') || text.includes('text')) {
        map[port.id] = 'linear-gradient(135deg, #7c3aed, #6d28d9)'; // purple
      }
    });
    return map;
  }, [inputPorts]);

  const customContent = (
    <>
      {executionData.status === 'success' && executionData.outputs?.image_generation_result && (
        <Alert severity="success" sx={{ mt: 1, fontSize: '0.75rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            Generated {executionData.outputs.image_generation_result.total_images} image(s)
            <Chip 
              label={executionData.outputs.model_used || 'dall-e-2'} 
              size="small" 
              sx={{ fontSize: '0.6rem', height: 16 }}
            />
          </Box>
          {executionData.outputs.prompt_used && (
            <Box component="span" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
              Prompt: {executionData.outputs.prompt_used.length > 50 ? 
                `${executionData.outputs.prompt_used.substring(0, 50)}...` : 
                executionData.outputs.prompt_used}
            </Box>
          )}
        </Alert>
      )}
      {executionData.status === 'error' && executionData.isError && (
        <Alert severity="error" sx={{ mt: 1, fontSize: '0.75rem' }}>
          {(() => {
            const err = (executionData as any)?.error as string | undefined;
            if (!err) return 'Generation failed';
            const lower = err.toLowerCase();
            if (lower.includes('api key')) return 'API key required in settings';
            if (lower.includes('prompt')) return 'Prompt required';
            return err;
          })()}
        </Alert>
      )}
    </>
  );

  return (
    <Box sx={{ position: 'relative', width: 'fit-content', height: 'fit-content', overflow: 'visible' }}>
      {/* Core node UI */}
      <CompactNodeContainer
        {...props}
        customColorName="coral"
        inputHandleGradientMap={inputHandleGradientMap}
        showExecuteButton={true}
        showDeleteButton={true}
      />
      {customContent}

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
        {/* Input labels (left) - positioned outside the node, aligned with handles */}
        {inputPorts.map((port: any, index: number) => {
          const topPercent = ((index + 1) / (inputPorts.length + 1)) * 100;
          const text = port.label || port.name;
          
          // Determine background color based on port name
          let bgColor = '#1e293b'; // default dark slate
          let borderColor = '#334155';
          
          if (text.toLowerCase().includes('prompt') || text.toLowerCase().includes('text')) {
            bgColor = '#6d28d9'; // dark purple
            borderColor = '#7c3aed'; // lighter purple border
          }
          
          return (
            <Box
              key={`input-label-${port.id}`}
              sx={{
                position: 'absolute',
                left: 0, // anchor to the node's left edge
                top: `${topPercent}%`,
                transform: 'translate(-12px, -50%)', // shift left by 12px to sit just outside
                backgroundColor: bgColor,
                color: '#ffffff',
                border: `1px solid ${borderColor}`,
                padding: '2px 5px',
                fontSize: '10px',
                fontWeight: 600,
                lineHeight: 1.2,
                textAlign: 'right',
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
