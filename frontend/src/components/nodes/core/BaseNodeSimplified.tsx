import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import { PlayArrow as ExecuteIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { NodeInstance, NodeType, NodeExecutionStatus } from '../../../types/nodes';
import { NodeExecutionManager } from './NodeExecutionManager';
import { useExecutionData } from '../hooks/useExecutionData';

// Business Logic Layer - NodePresenter
class SimpleNodePresenter {
  private nodeId: string;
  private instance: NodeInstance;
  private nodeType: NodeType;
  private executionManager: NodeExecutionManager;
  
  constructor(nodeId: string, instance: NodeInstance, nodeType: NodeType) {
    this.nodeId = nodeId;
    this.instance = instance;
    this.nodeType = nodeType;
    this.executionManager = NodeExecutionManager.getInstance();
  }
  
  getSafeConfig() {
    return {
      name: this.nodeType?.name || 'Unknown Node',
      description: this.nodeType?.description || 'No description available'
    };
  }
  
  getExecutionStatus(): NodeExecutionStatus {
    return this.executionManager.getStatus(this.nodeId);
  }
  
  isExecuting(): boolean {
    return this.getExecutionStatus() === NodeExecutionStatus.RUNNING;
  }
  
  shouldShowSuccessAnimation(): boolean {
    return this.getExecutionStatus() === NodeExecutionStatus.SUCCESS;
  }
}

// Presentation Data Interface
interface PresentationData {
  isHovered: boolean;
  isExecuting: boolean;
  showSuccessAnimation: boolean;
  safeConfig: {
    name: string;
    description: string;
  };
  onExecute: () => void;
  onDelete: () => void;
  onHover: (hovered: boolean) => void;
}

// Pure Presentation Component
const NodePresentation: React.FC<{
  data: PresentationData;
  children?: React.ReactNode;
}> = ({ data, children }) => {
  const {
    isHovered,
    isExecuting,
    showSuccessAnimation,
    safeConfig,
    onExecute,
    onDelete,
    onHover
  } = data;

  return (
    <Box
      sx={{
        position: 'relative',
        width: 280,
        height: 160,
        borderRadius: '12px',
        border: showSuccessAnimation ? '2px solid #10b981' : '1px solid rgba(0, 0, 0, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        cursor: 'pointer',
        transition: 'all 0.15s ease-out',
        transform: isHovered ? 'translateY(-2px) scale(1.02)' : 'translateY(0px) scale(1)',
        boxShadow: isHovered 
          ? '0 8px 24px rgba(0, 0, 0, 0.12)' 
          : '0 2px 8px rgba(0, 0, 0, 0.04)',
        padding: '16px'
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '14px' }}>
          {safeConfig.name}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 0.5, opacity: isHovered ? 1 : 0, transition: 'opacity 0.2s ease' }}>
          <IconButton
            size="small"
            onClick={onExecute}
            disabled={isExecuting}
            sx={{ width: 20, height: 20, color: 'rgba(34, 197, 94, 0.8)' }}
          >
            {isExecuting ? (
              <CircularProgress size={12} sx={{ color: 'inherit' }} />
            ) : (
              <ExecuteIcon sx={{ fontSize: 12 }} />
            )}
          </IconButton>
          
          <IconButton
            size="small"
            onClick={onDelete}
            sx={{ width: 20, height: 20, color: 'rgba(239, 68, 68, 0.8)' }}
          >
            <DeleteIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Box>
      </Box>
      
      {/* Content */}
      <Typography variant="caption" sx={{ color: '#64748b', fontSize: '11px' }}>
        {safeConfig.description}
      </Typography>
      
      {children}
    </Box>
  );
};

// Container Component with Business Logic
export interface BaseNodeSimplifiedProps {
  id: string;
  instance: NodeInstance;
  nodeType: NodeType;
  children?: React.ReactNode;
  onExecute?: () => void;
  onDelete?: () => void;
}

const BaseNodeSimplified: React.FC<BaseNodeSimplifiedProps> = ({
  id,
  instance,
  nodeType,
  children,
  onExecute,
  onDelete
}) => {
  // UI State (managed by container)
  const [isHovered, setIsHovered] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // Business Logic (delegated to presenter)
  const presenter = new SimpleNodePresenter(id, instance, nodeType);
  const executionData = useExecutionData({ id } as any);
  
  // Subscribe to execution status changes
  useEffect(() => {
    const executionManager = NodeExecutionManager.getInstance();
    const unsubscribe = executionManager.subscribe(id, (_, state) => {
      if (state.status === NodeExecutionStatus.SUCCESS) {
        setShowSuccessAnimation(true);
        const timer = setTimeout(() => setShowSuccessAnimation(false), 2000);
        return () => clearTimeout(timer);
      }
    });
    
    return unsubscribe;
  }, [id]);
  
  // Presentation data (bridge between business logic and UI)
  const presentationData: PresentationData = {
    isHovered,
    isExecuting: presenter.isExecuting(),
    showSuccessAnimation: presenter.shouldShowSuccessAnimation() || showSuccessAnimation,
    safeConfig: presenter.getSafeConfig(),
    onExecute: () => onExecute?.(),
    onDelete: () => onDelete?.(),
    onHover: setIsHovered
  };
  
  return (
    <NodePresentation data={presentationData}>
      {children}
    </NodePresentation>
  );
};

export default BaseNodeSimplified;
