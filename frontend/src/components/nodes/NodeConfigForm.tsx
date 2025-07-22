import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Switch,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Divider,
  Alert,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Refresh as ResetIcon,
  Visibility as PreviewIcon,
  Code as JsonIcon
} from '@mui/icons-material';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { NodeType, NodeInstance } from '../../types/nodes';
import { nodeService } from '../../services/nodeService';

// ============================================================================
// TYPES
// ============================================================================

interface NodeConfigFormProps {
  nodeType: NodeType;
  nodeInstance?: NodeInstance;
  onSave: (settings: Record<string, any>) => void;
  onCancel?: () => void;
  className?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getDefaultValue = (schema: JSONSchema7): any => {
  if (schema.default !== undefined) return schema.default;
  
  switch (schema.type) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
};

const validateField = (value: any, schema: JSONSchema7, fieldName: string): string | null => {
  // Required validation
  if (schema.required && (value === null || value === undefined || value === '')) {
    return `${fieldName} is required`;
  }

  // Type validation
  if (value !== null && value !== undefined && value !== '') {
    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') return `${fieldName} must be a string`;
        if (schema.minLength && value.length < schema.minLength) {
          return `${fieldName} must be at least ${schema.minLength} characters`;
        }
        if (schema.maxLength && value.length > schema.maxLength) {
          return `${fieldName} must be at most ${schema.maxLength} characters`;
        }
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
          return `${fieldName} format is invalid`;
        }
        break;
      case 'number':
      case 'integer':
        if (typeof value !== 'number' || isNaN(value)) return `${fieldName} must be a number`;
        if (schema.minimum !== undefined && value < schema.minimum) {
          return `${fieldName} must be at least ${schema.minimum}`;
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          return `${fieldName} must be at most ${schema.maximum}`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') return `${fieldName} must be true or false`;
        break;
    }
  }

  return null;
};

// ============================================================================
// COMPONENT
// ============================================================================

const NodeConfigForm: React.FC<NodeConfigFormProps> = ({
  nodeType,
  nodeInstance,
  onSave,
  onCancel,
  className
}) => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [showJsonView, setShowJsonView] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']));
  
  // Check if this is an OpenAI chat node (should be read-only)
  const isOpenAIChatNode = nodeType.id === 'simple-openai-chat';
  const isReadOnly = isOpenAIChatNode;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    initializeSettings();
  }, [nodeType, nodeInstance]);

  const initializeSettings = () => {
    const initialSettings: Record<string, any> = {};
    
    // Initialize from existing node instance or schema defaults
    const existingSettings = nodeInstance?.data?.settings || {};
    
    if (nodeType.settingsSchema.properties) {
      Object.entries(nodeType.settingsSchema.properties).forEach(([key, propSchema]) => {
        if (typeof propSchema === 'object' && propSchema !== null) {
          initialSettings[key] = existingSettings[key] !== undefined 
            ? existingSettings[key] 
            : getDefaultValue(propSchema as JSONSchema7);
        }
      });
    }
    
    setSettings(initialSettings);
    
    // For read-only nodes, clear validation errors
    if (isReadOnly) {
      setValidationErrors([]);
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const groupedProperties = useMemo(() => {
    const groups: Record<string, Array<[string, JSONSchema7]>> = {
      main: []
    };

    if (nodeType.settingsSchema.properties) {
      Object.entries(nodeType.settingsSchema.properties).forEach(([key, propSchema]) => {
        if (typeof propSchema === 'object' && propSchema !== null) {
          const schema = propSchema as JSONSchema7;
          const group = (schema as any).group || 'main';
          
          if (!groups[group]) {
            groups[group] = [];
          }
          
          groups[group].push([key, schema]);
        }
      });
    }

    return groups;
  }, [nodeType.settingsSchema]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleFieldChange = (fieldName: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear validation error for this field
    setValidationErrors(prev => prev.filter(error => error.field !== fieldName));
  };

  const handleSectionToggle = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const validateSettings = async (): Promise<boolean> => {
    // Skip validation for read-only nodes
    if (isReadOnly) {
      setValidationErrors([]);
      setIsValidating(false);
      return true;
    }
    
    setIsValidating(true);
    const errors: ValidationError[] = [];

    // Client-side validation
    if (nodeType.settingsSchema.properties) {
      Object.entries(nodeType.settingsSchema.properties).forEach(([key, propSchema]) => {
        if (typeof propSchema === 'object' && propSchema !== null) {
          const schema = propSchema as JSONSchema7;
          const value = settings[key];
          const error = validateField(value, schema, schema.title || key);
          
          if (error) {
            errors.push({ field: key, message: error });
          }
        }
      });
    }

    // Server-side validation
    try {
      const serverValidation = await nodeService.validation.validateNodeConfiguration(
        nodeType.id,
        settings
      );
      
      if (!serverValidation.valid) {
        serverValidation.errors.forEach(error => {
          errors.push({ field: 'general', message: error });
        });
      }
    } catch (error) {
      console.error('Server validation failed:', error);
      errors.push({ field: 'general', message: 'Failed to validate configuration' });
    }

    setValidationErrors(errors);
    setIsValidating(false);
    
    return errors.length === 0;
  };

  const handleSave = async () => {
    const isValid = await validateSettings();
    if (isValid) {
      onSave(settings);
    }
  };

  const handleReset = () => {
    initializeSettings();
    setValidationErrors([]);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderField = (fieldName: string, schema: JSONSchema7) => {
    const value = settings[fieldName];
    const error = validationErrors.find(err => err.field === fieldName);
    const isRequired = nodeType.settingsSchema.required?.includes(fieldName) || false;

    const commonProps = {
      fullWidth: true,
      margin: 'normal' as const,
      error: !!error && !isReadOnly,
      helperText: error?.message || schema.description,
      required: isRequired,
      disabled: isReadOnly
    };

    switch (schema.type) {
      case 'string':
        if (schema.enum) {
          return (
            <FormControl key={fieldName} {...commonProps}>
              <InputLabel>{schema.title || fieldName}</InputLabel>
              <Select
                value={value || ''}
                onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                label={schema.title || fieldName}
              >
                {schema.enum.map((option) => (
                  <MenuItem key={String(option)} value={String(option)}>
                    {String(option)}
                  </MenuItem>
                ))}
              </Select>
              {commonProps.helperText && (
                <FormHelperText error={commonProps.error}>
                  {commonProps.helperText}
                </FormHelperText>
              )}
            </FormControl>
          );
        }
        
        return (
          <TextField
            key={fieldName}
            label={schema.title || fieldName}
            value={value || ''}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            multiline={schema.format === 'textarea'}
            rows={schema.format === 'textarea' ? 4 : 1}
            type={schema.format === 'password' ? 'password' : 'text'}
            {...commonProps}
          />
        );

      case 'number':
      case 'integer':
        if (schema.minimum !== undefined && schema.maximum !== undefined) {
          return (
            <Box key={fieldName} sx={{ mt: 2, mb: 1 }}>
              <Typography gutterBottom>
                {schema.title || fieldName}
                {isRequired && <span style={{ color: 'red' }}> *</span>}
              </Typography>
              <Slider
                value={value || schema.minimum}
                onChange={(_, newValue) => handleFieldChange(fieldName, newValue)}
                min={schema.minimum}
                max={schema.maximum}
                step={schema.type === 'integer' ? 1 : 0.1}
                valueLabelDisplay="auto"
                marks={[
                  { value: schema.minimum, label: String(schema.minimum) },
                  { value: schema.maximum, label: String(schema.maximum) }
                ]}
              />
              {commonProps.helperText && (
                <FormHelperText error={commonProps.error}>
                  {commonProps.helperText}
                </FormHelperText>
              )}
            </Box>
          );
        }
        
        return (
          <TextField
            key={fieldName}
            label={schema.title || fieldName}
            type="number"
            value={value || ''}
            onChange={(e) => handleFieldChange(fieldName, parseFloat(e.target.value) || 0)}
            {...commonProps}
          />
        );

      case 'boolean':
        return (
          <FormControlLabel
            key={fieldName}
            control={
              <Switch
                checked={value || false}
                onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">
                  {schema.title || fieldName}
                  {isRequired && <span style={{ color: 'red' }}> *</span>}
                </Typography>
                {schema.description && (
                  <Typography variant="caption" color="text.secondary">
                    {schema.description}
                  </Typography>
                )}
              </Box>
            }
            sx={{ mt: 2, mb: 1, alignItems: 'flex-start' }}
          />
        );

      default:
        return (
          <TextField
            key={fieldName}
            label={schema.title || fieldName}
            value={JSON.stringify(value) || ''}
            onChange={(e) => {
              try {
                handleFieldChange(fieldName, JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, keep as string for now
              }
            }}
            multiline
            rows={3}
            {...commonProps}
          />
        );
    }
  };

  const renderSection = (sectionName: string, properties: Array<[string, JSONSchema7]>) => {
    const isExpanded = expandedSections.has(sectionName);
    const sectionTitle = sectionName === 'main' ? 'Configuration' : sectionName;

    return (
      <Accordion
        key={sectionName}
        expanded={isExpanded}
        onChange={() => handleSectionToggle(sectionName)}
        sx={{ mb: 1 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
            {sectionTitle}
          </Typography>
          <Chip
            label={properties.length}
            size="small"
            sx={{ ml: 1 }}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {properties.map(([fieldName, schema]) => renderField(fieldName, schema))}
          </Box>
        </AccordionDetails>
      </Accordion>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Paper className={className} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            Configure {nodeType.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={showJsonView ? 'Form View' : 'JSON View'}>
              <IconButton
                size="small"
                onClick={() => setShowJsonView(!showJsonView)}
                color={showJsonView ? 'primary' : 'default'}
              >
                {showJsonView ? <PreviewIcon /> : <JsonIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {nodeType.description}
        </Typography>
        {isReadOnly && (
          <Box sx={{ mt: 1 }}>
            <Chip 
              label="Read-Only Mode" 
              color="info" 
              size="small" 
              icon={<PreviewIcon />}
            />
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Configuration Errors:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Form or JSON View */}
        {showJsonView ? (
          <TextField
            fullWidth
            multiline
            rows={20}
            value={JSON.stringify(settings, null, 2)}
            onChange={(e) => {
              try {
                setSettings(JSON.parse(e.target.value));
                setValidationErrors([]);
              } catch (error) {
                // Invalid JSON
              }
            }}
            variant="outlined"
            sx={{ fontFamily: 'monospace' }}
          />
        ) : (
          <Box>
            {Object.entries(groupedProperties).map(([sectionName, properties]) =>
              renderSection(sectionName, properties)
            )}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Divider />
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ResetIcon />}
            onClick={handleReset}
            disabled={isReadOnly}
          >
            Reset
          </Button>
          {onCancel && (
            <Button variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Box>
        
        {!isReadOnly ? (
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={isValidating}
          >
            {isValidating ? 'Validating...' : 'Save Configuration'}
          </Button>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Read-only mode - Use settings button to edit
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default NodeConfigForm;
