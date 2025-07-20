import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  Tabs,
  Tab,
  Alert,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Settings as SettingsIcon,
  DataObject as DataIcon,
  Timeline as ExecutionIcon,
  Close as CloseIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { NodeInstance, NodeType, NodeValidationError } from '../../types/nodes';
import { PropertyPanel } from './PropertyPanel';
import { NodeDataViewer } from './NodeDataViewer';
import { ExecutionHistory } from './ExecutionHistory';

interface NodeInspectorProps {
  /** Selected node instance to inspect */
  selectedNode: NodeInstance | null;
  
  /** Node type definition for the selected node */
  nodeType: NodeType | null;
  
  /** Whether the inspector is open */
  open: boolean;
  
  /** Callback when inspector is closed */
  onClose: () => void;
  
  /** Callback when node settings are updated */
  onNodeUpdate: (nodeId: string, updates: Partial<NodeInstance>) => void;
  
  /** Validation errors for the current node */
  validationErrors?: NodeValidationError[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`inspector-tabpanel-${index}`}
      aria-labelledby={`inspector-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  selectedNode,
  nodeType,
  open,
  onClose,
  onNodeUpdate,
  validationErrors = []
}) => {
  const [activeTab, setActiveTab] = useState(0);

  // Reset tab when node changes
  useEffect(() => {
    setActiveTab(0);
  }, [selectedNode?.id]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSettingsUpdate = (settings: Record<string, any>) => {
    if (selectedNode) {
      onNodeUpdate(selectedNode.id, {
        data: {
          ...selectedNode.data,
          settings
        }
      });
    }
  };

  if (!open || !selectedNode || !nodeType) {
    return null;
  }

  const nodeErrors = validationErrors.filter(error => error.nodeId === selectedNode.id);
  const hasErrors = nodeErrors.length > 0;

  return (
    <Paper
      sx={{
        position: 'fixed',
        right: 16,
        top: 16,
        bottom: 16,
        width: 400,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 32px)',
        overflow: 'hidden'
      }}
      elevation={8}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {selectedNode.label}
          </Typography>
          <Chip
            label={nodeType.category}
            size="small"
            variant="outlined"
            sx={{ textTransform: 'capitalize' }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasErrors && (
            <Tooltip title={`${nodeErrors.length} validation error(s)`}>
              <Chip
                icon={<InfoIcon />}
                label={nodeErrors.length}
                color="error"
                size="small"
              />
            </Tooltip>
          )}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Node Info */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {nodeType.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Chip label={`v${nodeType.version}`} size="small" variant="outlined" />
          <Chip label={nodeType.name} size="small" variant="outlined" />
        </Box>
      </Box>

      {/* Error Summary */}
      {hasErrors && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Alert severity="error" sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Validation Issues ({nodeErrors.length})
            </Typography>
          </Alert>
          {nodeErrors.slice(0, 3).map((error, index) => (
            <Alert key={index} severity={error.severity} sx={{ mb: 1, fontSize: '0.8rem' }}>
              {error.message}
            </Alert>
          ))}
          {nodeErrors.length > 3 && (
            <Typography variant="caption" color="text.secondary">
              +{nodeErrors.length - 3} more issues...
            </Typography>
          )}
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ minHeight: 48 }}
        >
          <Tab
            icon={<SettingsIcon />}
            label="Settings"
            sx={{ minHeight: 48, fontSize: '0.8rem' }}
          />
          <Tab
            icon={<DataIcon />}
            label="Data"
            sx={{ minHeight: 48, fontSize: '0.8rem' }}
          />
          <Tab
            icon={<ExecutionIcon />}
            label="Execution"
            sx={{ minHeight: 48, fontSize: '0.8rem' }}
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <TabPanel value={activeTab} index={0}>
          <PropertyPanel
            nodeType={nodeType}
            settings={selectedNode.data.settings}
            onSettingsChange={handleSettingsUpdate}
            validationErrors={nodeErrors.filter(error => error.type === 'settings')}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <NodeDataViewer
            inputs={selectedNode.data.inputs}
            outputs={selectedNode.data.lastExecution?.outputs || {}}
            nodeType={nodeType}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <ExecutionHistory
            nodeInstance={selectedNode}
            lastExecution={selectedNode.data.lastExecution}
          />
        </TabPanel>
      </Box>
    </Paper>
  );
};
