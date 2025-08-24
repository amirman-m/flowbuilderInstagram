// src/components/nodes/hooks/useNodeConfigurationStatus.ts
import { useEffect } from 'react';
import { NodeExecutionStatus } from '../../../types/nodes';
import { NodeExecutionManager } from '../core/NodeExecutionManager';

/**
 * Custom hook to check if a node's settings are properly configured
 * and update its status accordingly (warning if not configured, pending if configured)
 * 
 * @param nodeId - The ID of the node to check
 * @param settings - The node's current settings object
 * @param requiredSettings - Array of required setting keys that must be present and non-empty
 * @returns Object containing status information
 */
export const useNodeConfigurationStatus = (
  nodeId: string,
  settings: Record<string, any>,
  requiredSettings: string[]
) => {
  useEffect(() => {
    const executionManager = NodeExecutionManager.getInstance();
    const currentStatus = executionManager.getStatus(nodeId);
    
    // Skip if node is already in a non-pending state (running, success, error)
    if (currentStatus !== NodeExecutionStatus.PENDING) {
      return;
    }
    
    // Check if all required settings are configured
    const isConfigured = requiredSettings.every(key => {
      const value = settings[key];
      return value !== undefined && value !== null && value !== '';
    });
    
    // Set warning status if not configured, pending if configured
    if (!isConfigured) {
      // Use WARNING as a custom status (not in the enum)
      executionManager.setStatus(
        nodeId, 
        'warning' as NodeExecutionStatus, 
        'Settings not configured'
      );
    } else {
      executionManager.setStatus(
        nodeId,
        NodeExecutionStatus.PENDING
      );
    }
  }, [nodeId, settings, requiredSettings]);
  
  return {
    isConfigured: requiredSettings.every(key => {
      const value = settings[key];
      return value !== undefined && value !== null && value !== '';
    })
  };
};
