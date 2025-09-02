// src/components/nodes/types/ScheduledMessageNode.tsx
import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Dialog, TextField, Button, Alert, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { CheckCircle as CheckCircleIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { NodeComponentProps, NodeDataWithHandlers } from '../registry';
import { NodeExecutionStatus } from '../../../types/nodes';
import { nodeService } from '../../../services/nodeService';
import { useParams } from 'react-router-dom';
import { CompactNodeContainer } from '../core/CompactNodeContainer';
import { useExecutionData } from '../hooks';
import { NodeExecutionManager } from '../core/NodeExecutionManager';
import { NodeResultDisplay } from '../core/NodeResultDisplay';

export const ScheduledMessageNode: React.FC<NodeComponentProps> = (props) => {
  const { data, id } = props;
  const { flowId } = useParams<{ flowId: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timeUnit, setTimeUnit] = useState('minutes');
  const [timeValue, setTimeValue] = useState(10);
  const [messageContent, setMessageContent] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const nodeData = data as NodeDataWithHandlers;
  const { instance } = nodeData;
  const [, setNodeStatus] = useState<NodeExecutionStatus>(NodeExecutionStatus.PENDING);
  
  // Use hooks
  const executionData = useExecutionData(nodeData);
  
  // Get time value options based on selected unit
  const getTimeValueOptions = () => {
    if (timeUnit === 'seconds') {
      return [30, 60];
    } else if (timeUnit === 'minutes') {
      return Array.from({ length: 60 }, (_, i) => i + 1);
    } else if (timeUnit === 'hours') {
      return Array.from({ length: 24 }, (_, i) => i + 1);
    }
    return [];
  };

  // Validate current time value when unit changes
  useEffect(() => {
    const validOptions = getTimeValueOptions();
    if (!validOptions.includes(timeValue)) {
      setTimeValue(validOptions[0] || 1);
    }
  }, [timeUnit]);

  // Load current settings when dialog opens or when settings change
  useEffect(() => {
    const settings = instance?.data?.settings;
    if (settings) {
      const unit = settings.time_unit || 'minutes';
      const currentValue = settings.time_value || 10;
      
      setTimeUnit(unit);
      
      // Validate and adjust time value based on unit
      if (unit === 'seconds') {
        // For seconds, default to 30 if current value is invalid
        setTimeValue([30, 60].includes(currentValue) ? currentValue : 30);
      } else if (unit === 'minutes') {
        // For minutes, clamp to 1-60 range
        setTimeValue(Math.max(1, Math.min(60, currentValue)));
      } else if (unit === 'hours') {
        // For hours, clamp to 1-24 range
        setTimeValue(Math.max(1, Math.min(24, currentValue)));
      } else {
        setTimeValue(currentValue);
      }
      
      setMessageContent(settings.message_content || '');
    }
  }, [instance?.data?.settings]);
  
  
  // Initialize node status based on execution data and sync with NodeExecutionManager
  useEffect(() => {
    const executionManager = NodeExecutionManager.getInstance();
    
    // Check execution data from store first (fresh results)
    if (executionData.hasFreshResults) {
      if (executionData.status === 'success') {
        setNodeStatus(NodeExecutionStatus.SUCCESS);
        executionManager.setStatus(id, NodeExecutionStatus.SUCCESS, 'Execution completed successfully');
      } else if (executionData.status === 'error') {
        setNodeStatus(NodeExecutionStatus.ERROR);
        executionManager.setStatus(id, NodeExecutionStatus.ERROR, 'Execution failed');
      }
    } else if (instance?.data?.lastExecution?.status === 'success') {
      setNodeStatus(NodeExecutionStatus.SUCCESS);
      executionManager.setStatus(id, NodeExecutionStatus.SUCCESS, 'Execution completed successfully');
    } else if (instance?.data?.lastExecution?.status === 'error') {
      setNodeStatus(NodeExecutionStatus.ERROR);
      executionManager.setStatus(id, NodeExecutionStatus.ERROR, 'Execution failed');
    } else {
      // Reset to pending if no execution data
      setNodeStatus(NodeExecutionStatus.PENDING);
      executionManager.setStatus(id, NodeExecutionStatus.PENDING, 'Ready to execute');
    }
  }, [id, executionData.hasFreshResults, executionData.status, instance?.data?.lastExecution]);
  
  // Validate settings before execution
  const validateSettings = () => {
    const settings = instance?.data?.settings;
    if (!settings?.time_unit || !settings?.time_value) {
      return false;
    }
    
    // Validate time value based on unit
    const unit = settings.time_unit;
    const value = settings.time_value;
    
    if (unit === 'seconds' && ![30, 60].includes(value)) {
      return false;
    }
    if (unit === 'minutes' && (value < 1 || value > 60)) {
      return false;
    }
    if (unit === 'hours' && (value < 1 || value > 24)) {
      return false;
    }
    
    return true;
  };

  // Let the container check before executing; opens dialog when invalid
  const handleBeforeExecute = () => {
    const ok = validateSettings();
    if (!ok) {
      setDialogOpen(true);
    }
    return ok;
  };

  // Execution is handled by CompactNodeContainer; we only gate via onBeforeExecute
  
  const handleSubmit = async () => {
    if (!flowId || !id) return;
    
    try {
      setIsExecuting(true);
      console.log('🕒 Executing Scheduled Message node via backend API...');
      setNodeStatus(NodeExecutionStatus.RUNNING);
      
      // Update NodeExecutionManager for visual feedback
      const executionManager = NodeExecutionManager.getInstance();
      executionManager.setStatus(id, NodeExecutionStatus.RUNNING, 'Executing...');
      
      // Auto-save flow before execution
      try {
        await new Promise((resolve, reject) => {
          const saveFlowEvent = new CustomEvent('autoSaveFlow', {
            detail: { 
              nodeId: id, 
              reason: 'pre-execution',
              callback: (error?: Error) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(null);
                }
              }
            }
          });
          window.dispatchEvent(saveFlowEvent);
        });
        console.log('✅ Auto-save completed');
      } catch (saveError) {
        console.warn('⚠️ Auto-save failed, continuing with execution:', saveError);
      }
      
      // Update node settings first
      const settings = {
        time_unit: timeUnit,
        time_value: timeValue,
        message_content: messageContent
      };
      
      if (nodeData.onNodeUpdate && id) {
        nodeData.onNodeUpdate(id, {
          data: {
            ...(instance?.data || {}),
            settings: settings
          },
          updatedAt: new Date()
        });
      }
      
      // Call backend API to execute the Scheduled Message node
      const executionContext = {
        settings: settings
      };
      
      // Execute the node through the backend
      const result = await nodeService.execution.executeNode(
        parseInt(flowId), 
        id,
        executionContext
      );
      
      console.log('🕒 Backend execution result:', result);
      
      setDialogOpen(false);
      // Update node state with execution results
      if (result && result.outputs) {
        setNodeStatus(NodeExecutionStatus.SUCCESS);
        setDialogOpen(false);
        
        // Update NodeExecutionManager for visual feedback
        const executionManager = NodeExecutionManager.getInstance();
        executionManager.setStatus(id, NodeExecutionStatus.SUCCESS, 'Execution completed successfully');
        
        // Update node data with execution results
        if (nodeData.onNodeUpdate && id) {
          nodeData.onNodeUpdate(id, {
            data: {
              ...(instance?.data || {}),
              settings: settings,
              lastExecution: {
                status: NodeExecutionStatus.SUCCESS,
                outputs: result.outputs || {},
                startedAt: new Date().toISOString(),
              },
              outputs: result.outputs || {}
            },
            updatedAt: new Date()
          });
          
          console.log('✅ Node state updated with execution results');
        } else {
          console.warn('⚠️ Could not update node state: onNodeUpdate function not available');
        }
      }
      
    } catch (error: any) {
      console.error('❌ Backend execution failed:', error);
      setNodeStatus(NodeExecutionStatus.ERROR);
      
      // Update NodeExecutionManager for visual feedback
      const executionManager = NodeExecutionManager.getInstance();
      executionManager.setStatus(id, NodeExecutionStatus.ERROR, 'Execution failed');
      
      // Keep dialog open on error so user can retry
    } finally {
      setIsExecuting(false);
    }
  };


  // Get display text for schedule
  const getScheduleDisplayText = () => {
    const settings = instance?.data?.settings;
    if (settings?.time_unit && settings?.time_value) {
      return `Every ${settings.time_value} ${settings.time_unit}`;
    }
    return `Every ${timeValue} ${timeUnit}`;
  };

  // Custom content for the ScheduledMessageNode
  const customContent = (
    <>
      {/* Schedule Display */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
        <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary">
          {getScheduleDisplayText()}
        </Typography>
      </Box>

      {/* Execution Results Display */}
      {(executionData.hasFreshResults || executionData.isExecuted) && (
        <NodeResultDisplay
          title="Scheduled Message:"
          content={(() => {
            const displayData = executionData.displayData;
            const outputs = executionData.outputs;
            
            // Try to get message data from different locations
            if (displayData?.type === 'message_data' && displayData?.inputText) {
              return displayData.inputText;
            } else if (outputs?.message_data?.input_text) {
              return outputs.message_data.input_text;
            } else if (outputs?.message_data?.metadata?.message_content) {
              return outputs.message_data.metadata.message_content;
            } else if (outputs?.message_data && typeof outputs.message_data === 'string') {
              return outputs.message_data;
            } else if (outputs?.message_data && typeof outputs.message_data === 'object') {
              return JSON.stringify(outputs.message_data, null, 2);
            } else {
              return 'No message data available';
            }
          })()}
        />
      )}
      
      {/* Success indicator for fresh execution */}
      {executionData.isSuccess && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">
            Scheduled message configured successfully
          </Typography>
        </Alert>
      )}
      
      {/* Node-specific dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={(e: React.MouseEvent<HTMLElement>) => {
          e.stopPropagation();
          setDialogOpen(false);
        }}
        onClick={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}
        maxWidth="sm"
        fullWidth
      >
        <Box sx={{ p: 3 }} onClick={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}>
          <Typography variant="h6" sx={{ mb: 2 }}>Configure Scheduled Message</Typography>
          
          {/* Time Unit Selection */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Time Unit</InputLabel>
            <Select
              value={timeUnit}
              onChange={(e) => setTimeUnit(e.target.value)}
              label="Time Unit"
            >
              <MenuItem value="seconds">Seconds</MenuItem>
              <MenuItem value="minutes">Minutes</MenuItem>
              <MenuItem value="hours">Hours</MenuItem>
            </Select>
          </FormControl>

          {/* Time Value Selection */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Time Value</InputLabel>
            <Select
              value={timeValue}
              onChange={(e) => setTimeValue(Number(e.target.value))}
              label="Time Value"
            >
              {getTimeValueOptions().map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Schedule Preview */}
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Schedule:</strong> Every {timeValue} {timeUnit}
            </Typography>
          </Alert>

          {/* Message Content */}
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Message Content"
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder="Enter the message to send periodically..."
            sx={{ mb: 2 }}
            inputProps={{ maxLength: 1000 }}
            helperText={`${messageContent.length}/1000 characters`}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={(e) => {
              e.stopPropagation();
              setDialogOpen(false);
            }}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={(e) => {
                e.stopPropagation();
                handleSubmit();
              }}
              disabled={isExecuting}
            >
              {isExecuting ? 'Configuring...' : 'Configure Schedule'}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </>
  );

return (
  <>
    <CompactNodeContainer
      {...props}
      customColorName="orange"
      onBeforeExecute={handleBeforeExecute}
    />

    {/* Configuration Dialog */}
    {customContent}
    
  </>
);
};
