import React, { useState } from 'react';
import { Box, Typography, Alert, Chip } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { useExecutionData } from '../hooks';
import { useNodeConfigurationStatus } from '../hooks/useNodeConfigurationStatus';
import { NodeResultDisplay } from '../core/NodeResultDisplay';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { ModelConfigWarningDialog } from '../../dialogs/ModelConfigWarningDialog';

/**
 * OpenAIImageDescriptionNode - A node that analyzes images using GPT-4o vision
 * and generates textual descriptions of the image content
 */
export const OpenAIImageDescriptionNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const nodeData = data as NodeDataWithHandlers;
  const { nodeType, instance } = nodeData;

  // State for configuration warning dialog
  const [showConfigWarning, setShowConfigWarning] = useState(false);
  const [pendingExecution, setPendingExecution] = useState(false);

  // Use execution data hook
  const executionData = useExecutionData({
    nodeType,
    instance,
    onNodeUpdate: nodeData.onNodeUpdate,
    onExecutionComplete: nodeData.onExecutionComplete
  });

  // Current settings
  const currentSettings = instance?.data?.settings || {};
  const { 
    model = 'gpt-4o', 
    system_prompt = '', 
    temperature = 0.3,
    detail_level = 'high'
  } = currentSettings;

  // Config status (require model at minimum)
  const { isConfigured } = useNodeConfigurationStatus(
    id,
    currentSettings,
    ['model']
  );

  // Get input ports for handle styling
  const inputPorts = props.data?.nodeType?.ports?.inputs ?? [];

  // Map input handles to colors: photo = orange, text = purple
  const inputHandleGradientMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    inputPorts.forEach((port: any) => {
      const text = (port.label || port.name || '').toString().toLowerCase();
      if (text.includes('photo') || text.includes('image')) {
        map[port.id] = 'linear-gradient(135deg, #f97316, #ea580c)'; // orange
      } else if (text.includes('text') || text.includes('context')) {
        map[port.id] = 'linear-gradient(135deg, #7c3aed, #6d28d9)'; // purple
      }
    });
    return map;
  }, [inputPorts]);

  // Convert any AI response payload to plain text
  const toPlainText = (input: any): string => {
    let text = '';
    if (typeof input === 'string') {
      text = input;
    } else if (input && typeof input === 'object') {
      if (typeof (input as any).ai_response === 'string') {
        text = (input as any).ai_response;
      } else if (typeof (input as any).aiResponse === 'string') {
        text = (input as any).aiResponse;
      } else {
        try {
          text = JSON.stringify(input);
        } catch {
          text = String(input);
        }
      }
    } else if (input != null) {
      text = String(input);
    }
    // Clean up markdown and HTML
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/[*_`>#-]+/g, ' ');
    return text.replace(/\s+/g, ' ').trim();
  };

  // Handle execution with model check
  const handleBeforeExecute = () => {
    const model = (instance?.data?.settings as any)?.model;
    if (!model) {
      setShowConfigWarning(true);
      setPendingExecution(true);
      return false; // Prevent execution until dialog is handled
    }
    return true;
  };

  // Continue execution without model
  const handleContinueAnyway = () => {
    setShowConfigWarning(false);

    // Execute the node directly without opening settings
    if (pendingExecution) {
      setPendingExecution(false);

      // Get the execution function from CompactNodeContainer
      const executionService = nodeData.onExecute;
      if (executionService) {
        // Call execution directly with required nodeId parameter
        setTimeout(() => {
          executionService(id);
        }, 100);
      }
    }
  };

  // Cancel execution
  const handleCancelExecution = () => {
    setShowConfigWarning(false);
    setPendingExecution(false);
  };

  const customContent = (
    <>
      {!executionData.isExecuted && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Model: {model || 'Not configured'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            Detail: {detail_level} • Temp: {temperature}
          </Typography>
          {system_prompt && (
            <Typography
              variant="caption"
              sx={{
                color: '#666',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '150px'
              }}
              title={system_prompt}
            >
              Prompt: {system_prompt}
            </Typography>
          )}
        </Box>
      )}

      {(executionData.hasFreshResults || executionData.isExecuted) && (
        <NodeResultDisplay
          title="Image Description:"
          content={(() => {
            const displayData = executionData.displayData;
            const outputs = executionData.outputs;

            if (displayData && typeof displayData === 'object' && 'ai_response' in displayData) {
              return toPlainText((displayData as any).ai_response);
            } else if (displayData && typeof displayData === 'object' && 'aiResponse' in displayData) {
              return toPlainText((displayData as any).aiResponse);
            } else if (outputs && typeof outputs === 'object' && 'ai_response' in outputs) {
              return toPlainText((outputs as any).ai_response);
            } else if (outputs && typeof outputs === 'object' && 'aiResponse' in outputs) {
              return toPlainText((outputs as any).aiResponse);
            } else if (displayData && typeof displayData === 'object') {
              return toPlainText(displayData);
            } else {
              return 'No image description available';
            }
          })()}
        />
      )}

      {executionData.isSuccess && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="caption">Image analyzed successfully</Typography>
            <Chip 
              label={model} 
              size="small" 
              sx={{ fontSize: '0.6rem', height: 16 }}
            />
          </Box>
          {executionData.outputs?.metadata?.total_tokens && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
              Tokens: {executionData.outputs.metadata.total_tokens}
            </Typography>
          )}
        </Alert>
      )}

      {executionData.isError && (
        <Alert 
          severity="error" 
          icon={<WarningIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">
            {(() => {
              const err = (executionData as any)?.error as string | undefined;
              if (!err) return 'Image analysis failed';
              const lower = err.toLowerCase();
              if (lower.includes('api key')) return 'OpenAI API key required';
              if (lower.includes('image') || lower.includes('photo')) return 'Valid image input required';
              if (lower.includes('model')) return 'Vision model required';
              return err.length > 50 ? `${err.substring(0, 50)}...` : err;
            })()}
          </Typography>
        </Alert>
      )}

      {!isConfigured && !executionData.isExecuted && (
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">Vision model not configured. Please configure settings.</Typography>
        </Alert>
      )}
    </>
  );

  return (
    <Box sx={{ position: 'relative', width: 'fit-content', height: 'fit-content', overflow: 'visible' }}>
      {/* Core node UI */}
      <CompactNodeContainer
        {...props}
        customColorName="emerald"
        inputHandleGradientMap={inputHandleGradientMap}
        onBeforeExecute={handleBeforeExecute}
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
          
          if (text.toLowerCase().includes('photo') || text.toLowerCase().includes('image')) {
            bgColor = '#ea580c'; // dark orange
            borderColor = '#f97316'; // lighter orange border
          } else if (text.toLowerCase().includes('text') || text.toLowerCase().includes('context')) {
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
      
      {/* Modern configuration warning dialog */}
      <ModelConfigWarningDialog
        open={showConfigWarning}
        onClose={handleCancelExecution}
        onContinue={handleContinueAnyway}
        nodeType="OpenAI Image Description"
        message="Vision model required for image analysis. Continue anyway?"
      />
    </Box>
  );
};
