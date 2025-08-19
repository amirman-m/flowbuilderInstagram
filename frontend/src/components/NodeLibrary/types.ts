/**
 * Comprehensive TypeScript interfaces for Node Library components
 * Covers all edge cases and provides strict type safety
 * 
 * @author Node Library Team
 * @version 1.0.0
 * @since 2024-08-14
 */

import { NodeCategory, NodeType } from '../../types/nodes';
import { CategoryItem } from '../../config/categories';
import { SvgIconProps } from '@mui/material';
import React from 'react';

// =============================================================================
// CORE TYPE DEFINITIONS
// =============================================================================

/**
 * Strict validation for node count values
 * Ensures node counts are always valid non-negative integers
 */
export type NodeCount = number & { __brand: 'NodeCount' };

/**
 * Type guard to validate node count
 */
export const isValidNodeCount = (value: unknown): value is NodeCount => {
  return typeof value === 'number' && 
         Number.isInteger(value) && 
         value >= 0 && 
         Number.isFinite(value);
};

/**
 * Safe node count creator with validation
 */
export const createNodeCount = (value: unknown): NodeCount => {
  if (isValidNodeCount(value)) {
    return value as NodeCount;
  }
  console.warn('Invalid node count value, defaulting to 0:', value);
  return 0 as NodeCount;
};

/**
 * Subcategory name with strict validation
 */
export type SubcategoryName = string & { __brand: 'SubcategoryName' };

/**
 * Type guard for subcategory names
 */
export const isValidSubcategoryName = (value: unknown): value is SubcategoryName => {
  return typeof value === 'string' && 
         value.length > 0 && 
         value.length <= 100 && 
         value.trim() === value;
};

/**
 * Safe subcategory name creator
 */
export const createSubcategoryName = (value: unknown): SubcategoryName | null => {
  if (isValidSubcategoryName(value)) {
    return value as SubcategoryName;
  }
  return null;
};

// =============================================================================
// COMPONENT PROP INTERFACES WITH COMPREHENSIVE VALIDATION
// =============================================================================

/**
 * Enhanced CategorySidebar props with strict validation
 * Covers all edge cases for category selection and display
 */
export interface StrictCategorySidebarProps {
  /** 
   * Array of category items to display
   * Must be non-empty array with valid CategoryItem objects
   */
  categories: readonly CategoryItem[] & { length: number };
  
  /** 
   * Currently selected category ID
   * Must be valid NodeCategory enum value or null
   */
  selectedCategory: NodeCategory | null;
  
  /** 
   * Callback function when a category is selected
   * Must handle all NodeCategory enum values
   */
  onCategorySelect: (categoryId: NodeCategory) => void;
  
  /** 
   * Function to get node count for a category
   * Must return valid non-negative integer for all categories
   */
  getCategoryNodeCount: (categoryId: NodeCategory) => NodeCount;
  
  /** 
   * Optional accessibility label for the sidebar
   */
  ariaLabel?: string;
  
  /** 
   * Optional test ID for testing
   */
  testId?: string;
}

/**
 * Enhanced NodeList props with comprehensive validation
 * Handles complex node grouping and interaction scenarios
 */
export interface StrictNodeListProps {
  /** 
   * Filtered and grouped nodes by subcategory
   * Keys must be valid subcategory names, values must be non-empty NodeType arrays
   */
  filteredAndGroupedNodes: Record<SubcategoryName, readonly NodeType[]>;
  
  /** 
   * Currently selected category ID
   * Must be valid NodeCategory enum value or null
   */
  selectedCategory: NodeCategory | null;
  
  /** 
   * Set of expanded subcategory names
   * All names must be valid subcategory identifiers
   */
  expandedSubcategories: ReadonlySet<SubcategoryName>;
  
  /** 
   * Callback when subcategory is toggled
   * Must handle valid subcategory names only
   */
  onSubcategoryToggle: (subcategory: SubcategoryName) => void;
  
  /** 
   * Callback when node drag starts
   * Must handle drag events and valid NodeType objects
   */
  onNodeDragStart: (event: React.DragEvent<HTMLElement>, nodeType: NodeType) => void;
  
  /** 
   * Callback when node info is clicked
   * Must handle valid NodeType objects
   */
  onNodeInfoClick: (nodeType: NodeType) => void;
  
  /** 
   * Array of category items for color mapping
   * Must contain all referenced categories
   */
  categories: readonly CategoryItem[];
  
  /** 
   * Optional maximum nodes to display per subcategory
   */
  maxNodesPerSubcategory?: number;
  
  /** 
   * Optional loading state indicator
   */
  isLoading?: boolean;
  
  /** 
   * Optional empty state message
   */
  emptyStateMessage?: string;
}

/**
 * Enhanced NodeInfoDialog props with validation
 * Ensures safe dialog state management
 */
export interface StrictNodeInfoDialogProps {
  /** 
   * Whether the dialog is open
   */
  open: boolean;
  
  /** 
   * Callback function when dialog is closed
   * Must be provided and handle all close scenarios
   */
  onClose: () => void;
  
  /** 
   * Node data to display
   * Must be valid NodeType object or null
   */
  node: NodeType | null;
  
  /** 
   * Array of category items for color mapping
   * Must contain category for the displayed node
   */
  categories: readonly CategoryItem[];
  
  /** 
   * Optional dialog title override
   */
  dialogTitle?: string;
  
  /** 
   * Optional maximum dialog width
   */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /** 
   * Optional full screen mode
   */
  fullScreen?: boolean;
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Comprehensive validation for CategoryItem objects
 */
export interface ValidatedCategoryItem extends CategoryItem {
  /** Validated category ID */
  id: NodeCategory;
  /** Non-empty category name */
  name: string & { length: number };
  /** Valid color hex code */
  color: string & { __brand: 'HexColor' };
  /** Valid React icon component */
  icon: React.ComponentType<SvgIconProps>;
}

/**
 * Type guard for CategoryItem validation
 */
export const isValidCategoryItem = (item: unknown): item is ValidatedCategoryItem => {
  if (!item || typeof item !== 'object') return false;
  
  const categoryItem = item as CategoryItem;
  
  // Validate required fields
  if (!categoryItem.id || !Object.values(NodeCategory).includes(categoryItem.id)) {
    console.warn('CategoryItem validation failed - invalid id:', categoryItem.id, 'Available values:', Object.values(NodeCategory));
    return false;
  }
  
  if (!categoryItem.name || typeof categoryItem.name !== 'string' || categoryItem.name.trim().length === 0) {
    console.warn('CategoryItem validation failed - invalid name:', categoryItem.name);
    return false;
  }
  
  if (!categoryItem.color || typeof categoryItem.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(categoryItem.color)) {
    console.warn('CategoryItem validation failed - invalid color:', categoryItem.color);
    return false;
  }
  
  if (!categoryItem.icon || (typeof categoryItem.icon !== 'function' && typeof categoryItem.icon !== 'object')) {
    console.warn('CategoryItem validation failed - invalid icon:', typeof categoryItem.icon, categoryItem.icon);
    return false;
  }
  
  // Additional check for React components (they can be functions or valid React component types)
  if (typeof categoryItem.icon === 'object') {
    // For object icons, we check if it's a valid React component type
    // React components can be functions or objects with a type property that is a function
    const iconObj = categoryItem.icon as any;
    
    // Check if it's a valid React component type
    // This can be a function component or a styled component
    if (typeof iconObj !== 'function' && typeof iconObj !== 'object') {
      console.warn('CategoryItem validation failed - icon is not a valid React component type:', categoryItem.icon);
      return false;
    }
    
    // If it's an object, check if it has the characteristics of a React component
    if (typeof iconObj === 'object' && iconObj !== null) {
      // Check for common React component patterns:
      // 1. Function components (already handled above)
      // 2. React.memo wrapped components ($$typeof: Symbol(react.memo))
      // 3. Styled components or other wrapped components with $$typeof property
      // 4. Components with a render function
      const hasReactMemoType = iconObj.$$typeof && iconObj.$$typeof.toString().includes('react.memo');
      const hasReactElementType = iconObj.$$typeof && iconObj.$$typeof.toString().includes('react.element');
      const hasReactForwardRefType = iconObj.$$typeof && iconObj.$$typeof.toString().includes('react.forward_ref');
      const hasTypeFunction = typeof iconObj.type === 'function';
      const hasRenderFunction = typeof iconObj.render === 'function';
      
      if (!hasReactMemoType && !hasReactElementType && !hasReactForwardRefType && !hasTypeFunction && !hasRenderFunction) {
        console.warn('CategoryItem validation failed - icon object is not a recognized React component pattern:', categoryItem.icon);
        return false;
      }
    }
  }
  
  return true;
};

/**
 * Comprehensive validation for NodeType objects
 */
export interface ValidatedNodeType extends NodeType {
  /** Non-empty node ID */
  id: string & { length: number };
  /** Non-empty node name */
  name: string & { length: number };
  /** Valid category */
  category: NodeCategory;
  /** Non-empty description */
  description: string & { length: number };
  // Note: ports are accessed via nodeType.ports.inputs and nodeType.ports.outputs
  // as defined in the base NodeType interface
}

/**
 * Validated port interface
 */
export interface ValidatedPort {
  /** Non-empty port ID */
  id: string & { length: number };
  /** Non-empty port name */
  name: string & { length: number };
  /** Valid data type */
  dataType: string & { length: number };
  /** Required flag */
  required: boolean;
  /** Optional description */
  description?: string;
}

/**
 * Type guard for NodeType validation
 */
export const isValidNodeType = (node: unknown): node is ValidatedNodeType => {
  if (!node || typeof node !== 'object') return false;
  
  const nodeType = node as NodeType;
  
  // Validate required string fields
  if (!nodeType.id || typeof nodeType.id !== 'string' || nodeType.id.trim().length === 0) {
    return false;
  }
  
  if (!nodeType.name || typeof nodeType.name !== 'string' || nodeType.name.trim().length === 0) {
    return false;
  }
  
  if (!nodeType.description || typeof nodeType.description !== 'string' || nodeType.description.trim().length === 0) {
    return false;
  }
  
  // Validate category
  if (!nodeType.category || !Object.values(NodeCategory).includes(nodeType.category)) {
    return false;
  }
  
  // Validate ports arrays - using correct property from NodeType interface
  if (!nodeType.ports || !Array.isArray(nodeType.ports.inputs) || !Array.isArray(nodeType.ports.outputs)) {
    return false;
  }
  
  // Validate individual ports
  const validatePort = (port: unknown): boolean => {
    if (!port || typeof port !== 'object') return false;
    const p = port as any;
    return typeof p.id === 'string' && p.id.length > 0 &&
           typeof p.name === 'string' && p.name.length > 0 &&
           typeof p.dataType === 'string' && p.dataType.length > 0 &&
           typeof p.required === 'boolean';
  };
  
  return nodeType.ports.inputs.every(validatePort) && nodeType.ports.outputs.every(validatePort);
};

// =============================================================================
// ERROR HANDLING TYPES
// =============================================================================

/**
 * Comprehensive error types for Node Library components
 */
export enum NodeLibraryErrorType {
  INVALID_PROPS = 'INVALID_PROPS',
  MISSING_CALLBACK = 'MISSING_CALLBACK',
  INVALID_NODE_DATA = 'INVALID_NODE_DATA',
  INVALID_CATEGORY_DATA = 'INVALID_CATEGORY_DATA',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Structured error interface for Node Library
 */
export interface NodeLibraryError {
  /** Error type classification */
  type: NodeLibraryErrorType;
  /** Human-readable error message */
  message: string;
  /** Component where error occurred */
  component: string;
  /** Additional error context */
  context?: Record<string, unknown>;
  /** Original error object if available */
  originalError?: Error;
  /** Timestamp when error occurred */
  timestamp: Date;
}

/**
 * Error factory for creating structured errors
 */
export const createNodeLibraryError = (
  type: NodeLibraryErrorType,
  message: string,
  component: string,
  context?: Record<string, unknown>,
  originalError?: Error
): NodeLibraryError => ({
  type,
  message,
  component,
  context,
  originalError,
  timestamp: new Date()
});

// =============================================================================
// PERFORMANCE OPTIMIZATION TYPES
// =============================================================================

/**
 * Performance monitoring interface
 */
export interface NodeLibraryPerformanceMetrics {
  /** Component render time in milliseconds */
  renderTime: number;
  /** Number of nodes rendered */
  nodeCount: number;
  /** Number of categories displayed */
  categoryCount: number;
  /** Memory usage estimate */
  memoryUsage?: number;
  /** Bundle loading metrics */
  bundleMetrics?: {
    loadedChunks: number;
    totalChunks: number;
    loadTime: number;
  };
}

/**
 * Memoization key generator for complex objects
 */
export type MemoizationKey<T> = (props: T) => string;

/**
 * Component state validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Array of validation errors */
  errors: string[];
  /** Array of validation warnings */
  warnings: string[];
  /** Performance impact assessment */
  performanceImpact?: 'low' | 'medium' | 'high';
}
