import { NodeInstance, NodeType, NodeExecutionStatus } from '../../../types/nodes';
import { NodeExecutionManager } from './NodeExecutionManager';
import { useExecutionData } from '../hooks/useExecutionData';

export interface NodePresentationData {
  // Visual state
  isHovered: boolean;
  isExecuting: boolean;
  showSuccessAnimation: boolean;
  selected: boolean;
  
  // Status and execution
  executionStatus: NodeExecutionStatus;
  statusMessage?: string;
  executionData: ReturnType<typeof useExecutionData>;
  
  // Configuration
  safeConfig: {
    name: string;
    description: string;
    category: string;
    version: string;
  };
  
  // Computed properties
  gradient: {
    primary: string;
    secondary: string;
  };
  
  // Action handlers
  handleExecute: (e: React.MouseEvent) => void;
  handleRefresh: (e: React.MouseEvent) => void;
  handleDelete: (e: React.MouseEvent) => void;
  handleHover: (isHovered: boolean) => void;
}

export class NodePresenter {
  private nodeId: string;
  private instance: NodeInstance;
  private nodeType: NodeType;
  private executionManager: NodeExecutionManager;
  
  // Callbacks
  private onExecuteCallback?: () => void;
  private onRefreshCallback?: () => void;
  private onDeleteCallback?: () => void;
  private onNodeUpdateCallback?: (updates: Partial<NodeInstance>) => void;
  
  constructor(
    nodeId: string,
    instance: NodeInstance,
    nodeType: NodeType,
    callbacks: {
      onExecute?: () => void;
      onRefresh?: () => void;
      onDelete?: () => void;
      onNodeUpdate?: (updates: Partial<NodeInstance>) => void;
    } = {}
  ) {
    this.nodeId = nodeId;
    this.instance = instance;
    this.nodeType = nodeType;
    this.executionManager = NodeExecutionManager.getInstance();
    
    this.onExecuteCallback = callbacks.onExecute;
    this.onRefreshCallback = callbacks.onRefresh;
    this.onDeleteCallback = callbacks.onDelete;
    this.onNodeUpdateCallback = callbacks.onNodeUpdate;
  }
  
  /**
   * Get safe configuration with defaults
   */
  getSafeConfig() {
    return {
      name: this.nodeType?.name || 'Unknown Node',
      description: this.nodeType?.description || 'No description available',
      category: this.nodeType?.category || 'general',
      version: this.nodeType?.version || '1.0.0'
    };
  }
  
  /**
   * Get gradient colors based on node category
   */
  getGradient() {
    const categoryColors: Record<string, { primary: string; secondary: string }> = {
      'ai': { primary: '#8b5cf6', secondary: '#a78bfa' },
      'input': { primary: '#10b981', secondary: '#34d399' },
      'output': { primary: '#f59e0b', secondary: '#fbbf24' },
      'processing': { primary: '#3b82f6', secondary: '#60a5fa' },
      'social': { primary: '#ec4899', secondary: '#f472b6' },
      'default': { primary: '#6b7280', secondary: '#9ca3af' }
    };
    
    const category = this.nodeType?.category || 'default';
    return categoryColors[category] || categoryColors['default'];
  }
  
  /**
   * Get current execution status
   */
  getExecutionStatus(): NodeExecutionStatus {
    const status = this.executionManager.getStatus(this.nodeId);
    return status?.status || NodeExecutionStatus.PENDING;
  }
  
  /**
   * Get status message
   */
  getStatusMessage(): string | undefined {
    const status = this.executionManager.getStatus(this.nodeId);
    return status?.message;
  }
  
  /**
   * Check if node is currently executing
   */
  isExecuting(): boolean {
    return this.getExecutionStatus() === NodeExecutionStatus.RUNNING;
  }
  
  /**
   * Check if should show success animation
   */
  shouldShowSuccessAnimation(): boolean {
    const status = this.getExecutionStatus();
    return status === NodeExecutionStatus.SUCCESS;
  }
  
  /**
   * Handle execute action
   */
  handleExecute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (this.isExecuting()) return;
    
    this.onExecuteCallback?.();
  };
  
  /**
   * Handle refresh action
   */
  handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    this.onRefreshCallback?.();
  };
  
  /**
   * Handle delete action
   */
  handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    this.onDeleteCallback?.();
  };
  
  /**
   * Handle hover state changes
   */
  handleHover = (_isHovered: boolean) => {
    // Can be extended for hover-specific business logic
  };
  
  /**
   * Update node instance data
   */
  updateNode(updates: Partial<NodeInstance>) {
    this.onNodeUpdateCallback?.(updates);
  }
  
  /**
   * Get input ports configuration
   */
  getInputPorts() {
    return this.nodeType?.ports?.inputs || [];
  }
  
  /**
   * Get output ports configuration
   */
  getOutputPorts() {
    return this.nodeType?.ports?.outputs || [];
  }
  
  /**
   * Check if a port is required
   */
  isPortRequired(portId: string): boolean {
    const allPorts = [...this.getInputPorts(), ...this.getOutputPorts()];
    const port = allPorts.find(p => p.id === portId);
    return port?.required || false;
  }
  
  /**
   * Get port configuration by ID
   */
  getPortConfig(portId: string) {
    const allPorts = [...this.getInputPorts(), ...this.getOutputPorts()];
    return allPorts.find(p => p.id === portId);
  }
  
  /**
   * Subscribe to execution status changes
   */
  subscribeToStatus(callback: (status: NodeExecutionStatus, message?: string) => void) {
    return this.executionManager.subscribe(this.nodeId, (statusData) => {
      callback(statusData.status, statusData.message);
    });
  }
  
  /**
   * Cleanup resources
   */
  dispose() {
    // Cleanup any subscriptions or resources
  }
}
