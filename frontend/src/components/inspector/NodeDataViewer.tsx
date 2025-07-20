import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon
} from '@mui/icons-material';
import { NodeType, NodeDataType } from '../../types/nodes';

interface NodeDataViewerProps {
  /** Current input values */
  inputs: Record<string, any>;
  
  /** Output values from last execution */
  outputs: Record<string, any>;
  
  /** Node type definition for port information */
  nodeType: NodeType;
}

interface DataDisplayProps {
  /** Data to display */
  data: any;
  
  /** Data type for formatting */
  dataType?: NodeDataType;
  
  /** Maximum depth to display for nested objects */
  maxDepth?: number;
  
  /** Current depth (for recursion) */
  currentDepth?: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`data-tabpanel-${index}`}
      aria-labelledby={`data-tab-${index}`}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

const DataDisplay: React.FC<DataDisplayProps> = ({
  data,
  dataType,
  maxDepth = 3,
  currentDepth = 0
}) => {
  const [showRaw, setShowRaw] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  };

  const getDataTypeColor = (type: NodeDataType): string => {
    switch (type) {
      case NodeDataType.STRING: return '#1976d2';
      case NodeDataType.NUMBER: return '#d32f2f';
      case NodeDataType.BOOLEAN: return '#7b1fa2';
      case NodeDataType.OBJECT: return '#f57c00';
      case NodeDataType.ARRAY: return '#388e3c';
      default: return '#616161';
    }
  };

  const renderValue = (value: any, depth: number = 0): React.ReactNode => {
    if (depth > maxDepth) {
      return (
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          [Max depth reached]
        </Typography>
      );
    }

    if (value === null || value === undefined) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          {String(value)}
        </Typography>
      );
    }

    if (typeof value === 'string') {
      return (
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
          "{value}"
        </Typography>
      );
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return (
        <Typography variant="body2" sx={{ color: getDataTypeColor(
          typeof value === 'number' ? NodeDataType.NUMBER : NodeDataType.BOOLEAN
        )}}>
          {String(value)}
        </Typography>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Empty array
          </Typography>
        );
      }

      return (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Array ({value.length} items)
          </Typography>
          <Box sx={{ ml: 2, mt: 1 }}>
            {value.slice(0, 5).map((item, index) => (
              <Box key={index} sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  [{index}]:
                </Typography>
                <Box sx={{ ml: 1 }}>
                  {renderValue(item, depth + 1)}
                </Box>
              </Box>
            ))}
            {value.length > 5 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                ... and {value.length - 5} more items
              </Typography>
            )}
          </Box>
        </Box>
      );
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Empty object
          </Typography>
        );
      }

      return (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Object ({entries.length} properties)
          </Typography>
          <Box sx={{ ml: 2, mt: 1 }}>
            {entries.slice(0, 5).map(([key, val]) => (
              <Box key={key} sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {key}:
                </Typography>
                <Box sx={{ ml: 1 }}>
                  {renderValue(val, depth + 1)}
                </Box>
              </Box>
            ))}
            {entries.length > 5 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                ... and {entries.length - 5} more properties
              </Typography>
            )}
          </Box>
        </Box>
      );
    }

    return (
      <Typography variant="body2">
        {String(value)}
      </Typography>
    );
  };

  if (data === null || data === undefined) {
    return (
      <Alert severity="info" sx={{ mt: 1 }}>
        No data available
      </Alert>
    );
  }

  const rawData = formatValue(data);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {dataType && (
            <Chip
              label={dataType}
              size="small"
              sx={{
                backgroundColor: `${getDataTypeColor(dataType)}20`,
                color: getDataTypeColor(dataType),
                fontWeight: 600
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={showRaw ? 'Show formatted' : 'Show raw JSON'}>
            <IconButton size="small" onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? <ViewIcon /> : <HideIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy to clipboard">
            <IconButton size="small" onClick={() => copyToClipboard(rawData)}>
              <CopyIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {showRaw ? (
        <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', maxHeight: 300, overflow: 'auto' }}>
          <Typography
            variant="body2"
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {rawData}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          {renderValue(data)}
        </Box>
      )}
    </Box>
  );
};

export const NodeDataViewer: React.FC<NodeDataViewerProps> = ({
  inputs,
  outputs,
  nodeType
}) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const inputPorts = nodeType.ports.inputs;
  const outputPorts = nodeType.ports.outputs;

  const hasInputs = inputPorts.length > 0;
  const hasOutputs = outputPorts.length > 0;

  return (
    <Box>
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label={`Inputs (${inputPorts.length})`} disabled={!hasInputs} />
        <Tab label={`Outputs (${outputPorts.length})`} disabled={!hasOutputs} />
      </Tabs>

      {/* Input Data */}
      <TabPanel value={activeTab} index={0}>
        {!hasInputs ? (
          <Alert severity="info">
            This node has no input ports.
          </Alert>
        ) : (
          <Box>
            {inputPorts.map((port) => {
              const value = inputs[port.name];
              const hasValue = value !== undefined && value !== null;

              return (
                <Accordion key={port.id} defaultExpanded={hasValue}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {port.label || port.name}
                      </Typography>
                      {port.required && (
                        <Chip label="Required" size="small" color="error" variant="outlined" />
                      )}
                      {!hasValue && (
                        <Chip label="No data" size="small" color="default" variant="outlined" />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {port.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                        {port.description}
                      </Typography>
                    )}
                    
                    <DataDisplay
                      data={hasValue ? value : port.defaultValue}
                      dataType={port.dataType}
                    />
                    
                    {!hasValue && port.defaultValue !== undefined && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        Using default value
                      </Alert>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}
      </TabPanel>

      {/* Output Data */}
      <TabPanel value={activeTab} index={1}>
        {!hasOutputs ? (
          <Alert severity="info">
            This node has no output ports.
          </Alert>
        ) : Object.keys(outputs).length === 0 ? (
          <Alert severity="warning">
            No output data available. Node hasn't been executed yet.
          </Alert>
        ) : (
          <Box>
            {outputPorts.map((port) => {
              const value = outputs[port.name];
              const hasValue = value !== undefined && value !== null;

              return (
                <Accordion key={port.id} defaultExpanded={hasValue}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {port.label || port.name}
                      </Typography>
                      {!hasValue && (
                        <Chip label="No data" size="small" color="default" variant="outlined" />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {port.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                        {port.description}
                      </Typography>
                    )}
                    
                    {hasValue ? (
                      <DataDisplay
                        data={value}
                        dataType={port.dataType}
                      />
                    ) : (
                      <Alert severity="info">
                        No output data for this port
                      </Alert>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}
      </TabPanel>
    </Box>
  );
};
