import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Switch,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Button,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as ResetIcon
} from '@mui/icons-material';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { NodeType, NodeValidationError } from '../../types/nodes';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

interface PropertyPanelProps {
  /** Node type definition containing the settings schema */
  nodeType: NodeType;
  
  /** Current settings values */
  settings: Record<string, any>;
  
  /** Callback when settings change */
  onSettingsChange: (settings: Record<string, any>) => void;
  
  /** Validation errors for settings */
  validationErrors?: NodeValidationError[];
}

interface FieldProps {
  /** Field name/key */
  name: string;
  
  /** JSON Schema definition for this field */
  schema: JSONSchema7;
  
  /** Current value */
  value: any;
  
  /** Callback when value changes */
  onChange: (value: any) => void;
  
  /** Validation error for this field */
  error?: string;
  
  /** Whether field is required */
  required?: boolean;
}

// Initialize AJV for validation
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const Field: React.FC<FieldProps> = ({
  name,
  schema,
  value,
  onChange,
  error,
  required = false
}) => {
  const fieldId = `field-${name}`;
  const hasError = Boolean(error);

  // Handle different field types based on schema
  const renderField = () => {
    switch (schema.type) {
      case 'string':
        if (schema.enum) {
          // Dropdown for enum values
          return (
            <FormControl fullWidth error={hasError} size="small">
              <InputLabel id={`${fieldId}-label`}>
                {schema.title || name} {required && '*'}
              </InputLabel>
              <Select
                labelId={`${fieldId}-label`}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                label={`${schema.title || name}${required ? ' *' : ''}`}
              >
                {schema.enum.map((option) => (
                  <MenuItem key={String(option)} value={String(option)}>
                    {String(option)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        } else {
          // Text input - special handling for system_prompt
          const isSystemPrompt = name === 'system_prompt';
          const isMultiline = schema.format === 'textarea' || isSystemPrompt;
          
          return (
            <TextField
              fullWidth
              size={isSystemPrompt ? "medium" : "small"}
              label={`${schema.title || name}${required ? ' *' : ''}`}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              error={hasError}
              helperText={error || schema.description}
              multiline={isMultiline}
              minRows={isSystemPrompt ? 6 : (schema.format === 'textarea' ? 3 : 1)}
              maxRows={isSystemPrompt ? 10 : (schema.format === 'textarea' ? 6 : undefined)}
              type={schema.format === 'password' ? 'password' : 'text'}
              sx={isSystemPrompt ? {
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '0.9rem'
                }
              } : undefined}
            />
          );
        }

      case 'number':
      case 'integer':
        // Special handling for temperature fields
        const isTemperatureField = name === 'temperature';
        const stepValue = isTemperatureField ? 0.1 : (schema.type === 'integer' ? 1 : 'any');
        
        return (
          <TextField
            fullWidth
            size="small"
            type="number"
            label={`${schema.title || name}${required ? ' *' : ''}`}
            value={value ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              onChange(val === '' ? undefined : Number(val));
            }}
            error={hasError}
            helperText={error || schema.description}
            inputProps={{
              min: schema.minimum,
              max: schema.maximum,
              step: stepValue
            }}
          />
        );

      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">
                  {schema.title || name} {required && '*'}
                </Typography>
                {schema.description && (
                  <Typography variant="caption" color="text.secondary">
                    {schema.description}
                  </Typography>
                )}
              </Box>
            }
          />
        );

      case 'array':
        return (
          <ArrayField
            name={name}
            schema={schema}
            value={value}
            onChange={onChange}
            error={error}
            required={required}
          />
        );

      case 'object':
        return (
          <ObjectField
            name={name}
            schema={schema}
            value={value}
            onChange={onChange}
            error={error}
            required={required}
          />
        );

      default:
        return (
          <TextField
            fullWidth
            size="small"
            label={`${schema.title || name}${required ? ' *' : ''}`}
            value={typeof value === 'string' ? value : JSON.stringify(value || '')}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                onChange(e.target.value);
              }
            }}
            error={hasError}
            helperText={error || schema.description || 'JSON format expected'}
            multiline
            rows={2}
          />
        );
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      {renderField()}
      {hasError && (
        <Alert severity="error" sx={{ mt: 1, fontSize: '0.8rem' }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

const ArrayField: React.FC<FieldProps> = ({ name, schema, value, onChange, error, required }) => {
  const arrayValue = Array.isArray(value) ? value : [];
  const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;

  const addItem = () => {
    const newItem = getDefaultValue(itemSchema as JSONSchema7);
    onChange([...arrayValue, newItem]);
  };

  const removeItem = (index: number) => {
    const newArray = arrayValue.filter((_, i) => i !== index);
    onChange(newArray);
  };

  const updateItem = (index: number, newValue: any) => {
    const newArray = [...arrayValue];
    newArray[index] = newValue;
    onChange(newArray);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {schema.title || name} {required && '*'}
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={addItem}
          variant="outlined"
        >
          Add Item
        </Button>
      </Box>
      
      {schema.description && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          {schema.description}
        </Typography>
      )}

      {arrayValue.map((item, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Field
              name={`${name}[${index}]`}
              schema={itemSchema as JSONSchema7}
              value={item}
              onChange={(newValue) => updateItem(index, newValue)}
            />
          </Box>
          <IconButton
            size="small"
            onClick={() => removeItem(index)}
            color="error"
            sx={{ mt: 0.5 }}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      ))}

      {arrayValue.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', p: 2, textAlign: 'center' }}>
          No items added yet
        </Typography>
      )}
    </Box>
  );
};

const ObjectField: React.FC<FieldProps> = ({ name, schema, value, onChange, error, required }) => {
  const objectValue = value && typeof value === 'object' ? value : {};
  const properties = schema.properties || {};
  const requiredFields = schema.required || [];

  const updateProperty = (propName: string, propValue: any) => {
    onChange({
      ...objectValue,
      [propName]: propValue
    });
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {schema.title || name} {required && '*'}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {schema.description && (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            {schema.description}
          </Typography>
        )}
        
        {Object.entries(properties).map(([propName, propSchema]) => (
          <Field
            key={propName}
            name={propName}
            schema={propSchema as JSONSchema7}
            value={objectValue[propName]}
            onChange={(newValue) => updateProperty(propName, newValue)}
            required={requiredFields.includes(propName)}
          />
        ))}
      </AccordionDetails>
    </Accordion>
  );
};

// Helper function to get default value for a schema
const getDefaultValue = (schema: JSONSchema7): any => {
  if (schema.default !== undefined) {
    return schema.default;
  }

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

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  nodeType,
  settings,
  onSettingsChange,
  validationErrors = []
}) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Update local settings when props change (but avoid infinite loops)
  useEffect(() => {
    // Only update if settings actually changed (deep comparison for objects)
    if (JSON.stringify(localSettings) !== JSON.stringify(settings)) {
      setLocalSettings(settings);
    }
  }, [settings]); // Remove localSettings from dependency to prevent loop

  // Validate settings whenever they change
  useEffect(() => {
    const validate = ajv.compile(nodeType.settingsSchema);
    const isValid = validate(localSettings);
    setValidationResult({
      isValid,
      errors: validate.errors || []
    });
  }, [localSettings, nodeType.settingsSchema]);

  const handleSettingChange = (key: string, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const resetToDefaults = () => {
    const defaultSettings: Record<string, any> = {};
    const properties = nodeType.settingsSchema.properties || {};
    
    Object.entries(properties).forEach(([key, schema]) => {
      defaultSettings[key] = getDefaultValue(schema as JSONSchema7);
    });
    
    setLocalSettings(defaultSettings);
    onSettingsChange(defaultSettings);
  };

  const properties = nodeType.settingsSchema.properties || {};
  const requiredFields = nodeType.settingsSchema.required || [];
  const hasProperties = Object.keys(properties).length > 0;

  // Create error map for quick lookup
  const errorMap: Record<string, string> = {};
  validationErrors.forEach(error => {
    if (error.field) {
      errorMap[error.field] = error.message;
    }
  });

  // Add AJV validation errors
  if (validationResult?.errors) {
    validationResult.errors.forEach((error: any) => {
      const fieldPath = error.instancePath.replace(/^\//, '') || error.params?.missingProperty;
      if (fieldPath) {
        errorMap[fieldPath] = error.message;
      }
    });
  }

  if (!hasProperties) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          This node has no configurable settings.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with validation status */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
          Configuration
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {validationResult && (
            <Chip
              label={validationResult.isValid ? 'Valid' : 'Invalid'}
              color={validationResult.isValid ? 'success' : 'error'}
              size="small"
            />
          )}
          <Tooltip title="Reset to defaults">
            <IconButton size="small" onClick={resetToDefaults}>
              <ResetIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Settings fields */}
      {Object.entries(properties).map(([key, schema]) => (
        <Field
          key={key}
          name={key}
          schema={schema as JSONSchema7}
          value={localSettings[key]}
          onChange={(value) => handleSettingChange(key, value)}
          error={errorMap[key]}
          required={requiredFields.includes(key)}
        />
      ))}

      {/* Validation summary */}
      {validationResult && !validationResult.isValid && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Configuration Issues
          </Typography>
          <Typography variant="body2">
            Please fix the validation errors above before the node can be executed.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};
