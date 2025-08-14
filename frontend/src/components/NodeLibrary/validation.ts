/**
 * Comprehensive validation utilities for Node Library components
 * Ensures type safety and handles all edge cases
 * 
 * @author Node Library Team
 * @version 1.0.0
 * @since 2024-08-14
 */

// Type declaration for NodeJS ProcessEnv to fix "Cannot find name 'process'" error
declare const process: {
  env: {
    NODE_ENV: 'development' | 'production' | 'test';
    [key: string]: string | undefined;
  };
};

import React from 'react';
import { 
  NodeLibraryErrorType, 
  createNodeLibraryError,
  ValidationResult,
  isValidNodeType,
  isValidCategoryItem,
  NodeCount,
  createNodeCount,
  SubcategoryName,
  isValidSubcategoryName
} from './types';
import { NodeCategory } from '../../types/nodes';

// =============================================================================
// PROP VALIDATION UTILITIES
// =============================================================================

/**
 * Validates CategorySidebar props with comprehensive error reporting
 * 
 * @param props - Props to validate
 * @returns Validation result with detailed errors and warnings
 */
export const validateCategorySidebarProps = (props: {
  categories?: unknown;
  selectedCategory?: unknown;
  onCategorySelect?: unknown;
  getCategoryNodeCount?: unknown;
}): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate categories array
  if (!props.categories) {
    errors.push('categories prop is required');
  } else if (!Array.isArray(props.categories)) {
    errors.push('categories must be an array');
  } else if (props.categories.length === 0) {
    warnings.push('categories array is empty - no categories will be displayed');
  } else {
    // Validate individual category items
    props.categories.forEach((category, index) => {
      if (!isValidCategoryItem(category)) {
        errors.push(`categories[${index}] is not a valid CategoryItem`);
      }
    });
  }
  
  // Validate selectedCategory
  if (props.selectedCategory !== null && props.selectedCategory !== undefined) {
    if (!Object.values(NodeCategory).includes(props.selectedCategory as NodeCategory)) {
      errors.push('selectedCategory must be a valid NodeCategory enum value or null');
    }
  }
  
  // Validate callback functions
  if (!props.onCategorySelect) {
    errors.push('onCategorySelect callback is required');
  } else if (typeof props.onCategorySelect !== 'function') {
    errors.push('onCategorySelect must be a function');
  }
  
  if (!props.getCategoryNodeCount) {
    errors.push('getCategoryNodeCount function is required');
  } else if (typeof props.getCategoryNodeCount !== 'function') {
    errors.push('getCategoryNodeCount must be a function');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    performanceImpact: props.categories && Array.isArray(props.categories) && props.categories.length > 10 ? 'medium' : 'low'
  };
};

/**
 * Validates NodeList props with comprehensive error reporting
 * 
 * @param props - Props to validate
 * @returns Validation result with detailed errors and warnings
 */
export const validateNodeListProps = (props: {
  filteredAndGroupedNodes?: unknown;
  selectedCategory?: unknown;
  expandedSubcategories?: unknown;
  onSubcategoryToggle?: unknown;
  onNodeDragStart?: unknown;
  onNodeInfoClick?: unknown;
  categories?: unknown;
}): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalNodes = 0;
  
  // Validate filteredAndGroupedNodes
  if (!props.filteredAndGroupedNodes) {
    errors.push('filteredAndGroupedNodes prop is required');
  } else if (typeof props.filteredAndGroupedNodes !== 'object' || Array.isArray(props.filteredAndGroupedNodes)) {
    errors.push('filteredAndGroupedNodes must be an object');
  } else {
    const grouped = props.filteredAndGroupedNodes as Record<string, unknown>;
    
    if (Object.keys(grouped).length === 0) {
      warnings.push('filteredAndGroupedNodes is empty - no nodes will be displayed');
    }
    
    // Validate each subcategory
    Object.entries(grouped).forEach(([subcategory, nodes]) => {
      if (!isValidSubcategoryName(subcategory)) {
        errors.push(`Invalid subcategory name: "${subcategory}"`);
      }
      
      if (!Array.isArray(nodes)) {
        errors.push(`Nodes for subcategory "${subcategory}" must be an array`);
      } else {
        if (nodes.length === 0) {
          warnings.push(`Subcategory "${subcategory}" has no nodes`);
        } else {
          totalNodes += nodes.length;
          
          // Validate individual nodes
          nodes.forEach((node, index) => {
            if (!isValidNodeType(node)) {
              errors.push(`Invalid node at subcategory "${subcategory}"[${index}]`);
            }
          });
        }
      }
    });
  }
  
  // Validate selectedCategory
  if (props.selectedCategory !== null && props.selectedCategory !== undefined) {
    if (!Object.values(NodeCategory).includes(props.selectedCategory as NodeCategory)) {
      errors.push('selectedCategory must be a valid NodeCategory enum value or null');
    }
  }
  
  // Validate expandedSubcategories
  if (!props.expandedSubcategories) {
    errors.push('expandedSubcategories prop is required');
  } else if (!(props.expandedSubcategories instanceof Set)) {
    errors.push('expandedSubcategories must be a Set');
  }
  
  // Validate callback functions
  const requiredCallbacks = [
    'onSubcategoryToggle',
    'onNodeDragStart', 
    'onNodeInfoClick'
  ];
  
  requiredCallbacks.forEach(callbackName => {
    const callback = props[callbackName as keyof typeof props];
    if (!callback) {
      errors.push(`${callbackName} callback is required`);
    } else if (typeof callback !== 'function') {
      errors.push(`${callbackName} must be a function`);
    }
  });
  
  // Validate categories
  if (!props.categories) {
    errors.push('categories prop is required');
  } else if (!Array.isArray(props.categories)) {
    errors.push('categories must be an array');
  }
  
  // Performance impact assessment
  let performanceImpact: 'low' | 'medium' | 'high' = 'low';
  if (totalNodes > 100) {
    performanceImpact = 'high';
    warnings.push(`High node count (${totalNodes}) may impact performance`);
  } else if (totalNodes > 50) {
    performanceImpact = 'medium';
    warnings.push(`Medium node count (${totalNodes}) - consider pagination`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    performanceImpact
  };
};

/**
 * Validates NodeInfoDialog props with comprehensive error reporting
 * 
 * @param props - Props to validate
 * @returns Validation result with detailed errors and warnings
 */
export const validateNodeInfoDialogProps = (props: {
  open?: unknown;
  onClose?: unknown;
  node?: unknown;
  categories?: unknown;
}): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate open prop
  if (typeof props.open !== 'boolean') {
    errors.push('open prop must be a boolean');
  }
  
  // Validate onClose callback
  if (!props.onClose) {
    errors.push('onClose callback is required');
  } else if (typeof props.onClose !== 'function') {
    errors.push('onClose must be a function');
  }
  
  // Validate node prop
  if (props.node !== null && props.node !== undefined) {
    if (!isValidNodeType(props.node)) {
      errors.push('node must be a valid NodeType object or null');
    }
  } else if (props.open === true) {
    warnings.push('Dialog is open but no node is provided');
  }
  
  // Validate categories
  if (!props.categories) {
    errors.push('categories prop is required');
  } else if (!Array.isArray(props.categories)) {
    errors.push('categories must be an array');
  } else if (props.categories.length === 0) {
    warnings.push('categories array is empty');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    performanceImpact: 'low'
  };
};

// =============================================================================
// RUNTIME VALIDATION HELPERS
// =============================================================================

/**
 * Safe prop validator that logs errors and returns sanitized props
 * 
 * @param props - Props to validate
 * @param validator - Validation function
 * @param componentName - Name of component for error logging
 * @returns Sanitized props or null if validation fails
 */
export const safeValidateProps = <T>(
  props: T,
  validator: (props: T) => ValidationResult,
  componentName: string
): T | null => {
  try {
    const result = validator(props);
    
    // Log warnings
    if (result.warnings.length > 0) {
      console.warn(`${componentName} validation warnings:`, result.warnings);
    }
    
    // Log errors and return null if invalid
    if (!result.isValid) {
      console.error(`${componentName} validation errors:`, result.errors);
      return null;
    }
    
    // Log performance warnings
    if (result.performanceImpact === 'high') {
      console.warn(`${componentName} may have performance issues due to high data volume`);
    }
    
    return props;
  } catch (error) {
    console.error(`${componentName} validation failed with exception:`, error);
    return null;
  }
};

/**
 * Creates a safe callback wrapper that handles errors gracefully
 * 
 * @param callback - Original callback function
 * @param callbackName - Name of callback for error logging
 * @param componentName - Name of component for error context
 * @returns Wrapped callback that handles errors
 */
export const safeCallback = <T extends (...args: any[]) => any>(
  callback: T | undefined,
  callbackName: string,
  componentName: string
): T => {
  if (!callback || typeof callback !== 'function') {
    return ((...args: Parameters<T>) => {
      console.warn(`${componentName}: ${callbackName} callback not provided or invalid`);
    }) as T;
  }
  
  return ((...args: Parameters<T>) => {
    try {
      return callback(...args);
    } catch (error) {
      const nodeLibraryError = createNodeLibraryError(
        NodeLibraryErrorType.MISSING_CALLBACK,
        `Error in ${callbackName} callback`,
        componentName,
        { args },
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Callback error:', nodeLibraryError);
    }
  }) as T;
};

/**
 * Validates and sanitizes node count values
 * 
 * @param value - Value to validate as node count
 * @param context - Context for error logging
 * @returns Valid NodeCount or 0 as fallback
 */
export const validateNodeCount = (value: unknown, context: string): NodeCount => {
  const nodeCount = createNodeCount(value);
  
  if (nodeCount !== value) {
    console.warn(`Invalid node count in ${context}, using 0 as fallback:`, value);
  }
  
  return nodeCount;
};

/**
 * Validates and sanitizes subcategory names
 * 
 * @param value - Value to validate as subcategory name
 * @param context - Context for error logging
 * @returns Valid SubcategoryName or null if invalid
 */
export const validateSubcategoryName = (value: unknown, context: string): SubcategoryName | null => {
  if (!isValidSubcategoryName(value)) {
    console.warn(`Invalid subcategory name in ${context}:`, value);
    return null;
  }
  
  return value as SubcategoryName;
};

// =============================================================================
// COMPONENT-SPECIFIC VALIDATION WRAPPERS
// =============================================================================

/**
 * Higher-order component that adds prop validation to any component
 * 
 * @param Component - React component to wrap
 * @param validator - Validation function
 * @param componentName - Name for error logging
 * @returns Wrapped component with validation
 */
export const withPropValidation = <P extends object,>(
  Component: React.ComponentType<P>,
  validator: (props: P) => ValidationResult,
  componentName: string
) => {
  return React.forwardRef<any, P>((props, ref): React.ReactNode => {  // Add explicit return type
    // forwardRef passes PropsWithoutRef<P>; cast to P for validation
    const validatedProps = safeValidateProps(props as unknown as P, validator, componentName);
    
    if (!validatedProps) {
      return React.createElement(
        'div',
        {
          style: {
            padding: '16px',
            border: '2px solid red',
            borderRadius: '4px',
            backgroundColor: '#ffebee',
            color: '#c62828'
          }
        },
        React.createElement('strong', null, `Component Error: ${componentName}`),
        React.createElement('br', null),
        'Invalid props provided. Check console for details.'
      );
    }
    
    return React.createElement(Component as React.ElementType, { ...(validatedProps as any), ref });
  });
};

/**
 * Development-only prop validation (removed in production builds)
 * 
 * @param props - Props to validate
 * @param validator - Validation function
 * @param componentName - Component name for logging
 */
export const devValidateProps = <T,>(
  props: T,
  validator: (props: T) => ValidationResult,
  componentName: string
): void => {
  if (process.env.NODE_ENV === 'development') {
    const result = validator(props);
    
    if (result.warnings.length > 0) {
      console.warn(`[DEV] ${componentName} warnings:`, result.warnings);
    }
    
    if (!result.isValid) {
      console.error(`[DEV] ${componentName} errors:`, result.errors);
    }
  }
};
