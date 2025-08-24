// Node status types and interfaces for flexible status management
export enum NodeStatusType {
  SUCCESS = 'success',
  ERROR = 'error', 
  WARNING = 'warning',
  RUNNING = 'running',
  READY = 'ready'
}

export interface NodeStatus {
  type: NodeStatusType;
  message?: string;
  animated?: boolean;
}

export interface NodeStatusConfig {
  success: {
    color: string;
    icon: string;
    label: string;
  };
  error: {
    color: string;
    icon: string;
    label: string;
  };
  warning: {
    color: string;
    icon: string;
    label: string;
  };
  running: {
    color: string;
    icon: string;
    label: string;
    animated: boolean;
  };
  ready: {
    color: string;
    icon: string;
    label: string;
  };
}

export const DEFAULT_NODE_STATUS_CONFIG: NodeStatusConfig = {
  success: {
    color: '#10b981', // Green
    icon: '✓',
    label: 'Success'
  },
  error: {
    color: '#ef4444', // Red
    icon: '✕',
    label: 'Error'
  },
  warning: {
    color: '#f59e0b', // Orange
    icon: '⚠',
    label: 'Warning'
  },
  running: {
    color: '#f59e0b', // Orange
    icon: '⟳',
    label: 'Running...',
    animated: true
  },
  ready: {
    color: '#6b7280', // Gray
    icon: '●',
    label: 'Ready'
  }
};
