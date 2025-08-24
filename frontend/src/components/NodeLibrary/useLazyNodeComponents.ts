import { useCallback, useEffect, useMemo } from 'react';
import { NodeCategory, NodeType } from '../../types/nodes';
import { preloadNodeComponents, getBundleInfo } from './LazyNodeComponents';
import { NODE_REGISTRY } from '../../config/nodeRegistry';

/**
 * Custom hook for managing lazy-loaded node components
 * Provides preloading functionality and bundle optimization
 * 
 * @author Node Library Team
 * @version 1.0.0
 * @since 2024-08-14
 * 
 * @example
 * ```tsx
 * const {
 *   preloadCategory,
 *   preloadNodes,
 *   bundleInfo,
 *   isComponentLoaded
 * } = useLazyNodeComponents();
 * 
 * // Preload components when user hovers over category
 * const handleCategoryHover = (categoryId: NodeCategory) => {
 *   preloadCategory(categoryId);
 * };
 * ```
 */
export const useLazyNodeComponents = () => {
  /**
   * Preload all node components for a specific category
   * Useful for improving UX when user selects or hovers over a category
   * 
   * @param category - The category to preload components for
   * @param nodeTypes - Available node types (optional, for filtering)
   */
  const preloadCategory = useCallback((
    category: NodeCategory,
    nodeTypes?: NodeType[]
  ) => {
    // Get all node type IDs for the category
    const nodeTypeIds = Object.entries(NODE_REGISTRY)
      .filter(([, config]) => config.category === category)
      .map(([nodeTypeId]) => nodeTypeId);
    
    // If nodeTypes provided, filter to only available ones
    const availableNodeTypeIds = nodeTypes 
      ? nodeTypeIds.filter(id => nodeTypes.some(node => node.id === id))
      : nodeTypeIds;
    
    if (availableNodeTypeIds.length > 0) {
      console.debug(`Preloading ${availableNodeTypeIds.length} components for category: ${category}`, availableNodeTypeIds);
      preloadNodeComponents(availableNodeTypeIds);
    }
  }, []);

  /**
   * Preload specific node components by their IDs
   * 
   * @param nodeTypeIds - Array of node type IDs to preload
   */
  const preloadNodes = useCallback((nodeTypeIds: string[]) => {
    if (nodeTypeIds.length > 0) {
      console.debug(`Preloading ${nodeTypeIds.length} node components:`, nodeTypeIds);
      preloadNodeComponents(nodeTypeIds);
    }
  }, []);

  /**
   * Preload components for nodes in a subcategory
   * 
   * @param subcategory - The subcategory name
   * @param nodeTypes - Available node types for filtering
   */
  const preloadSubcategory = useCallback((
    subcategory: string,
    nodeTypes?: NodeType[]
  ) => {
    // Get all node type IDs for the subcategory
    const nodeTypeIds = Object.entries(NODE_REGISTRY)
      .filter(([, config]) => config.subcategory === subcategory)
      .map(([nodeTypeId]) => nodeTypeId);
    
    // Filter to only available node types if provided
    const availableNodeTypeIds = nodeTypes 
      ? nodeTypeIds.filter(id => nodeTypes.some(node => node.id === id))
      : nodeTypeIds;
    
    if (availableNodeTypeIds.length > 0) {
      console.debug(`Preloading ${availableNodeTypeIds.length} components for subcategory: ${subcategory}`, availableNodeTypeIds);
      preloadNodeComponents(availableNodeTypeIds);
    }
  }, []);

  /**
   * Get current bundle loading information
   * Useful for debugging and monitoring
   */
  const bundleInfo = useMemo(() => getBundleInfo(), []);

  /**
   * Check if a specific component is already loaded
   * 
   * @param nodeTypeId - The node type ID to check
   * @returns boolean indicating if component is loaded
   */
  const isComponentLoaded = useCallback((nodeTypeId: string): boolean => {
    const info = getBundleInfo();
    return info.loadedComponentIds.includes(nodeTypeId);
  }, []);

  /**
   * Preload the most commonly used components on hook initialization
   * This improves perceived performance for frequently accessed nodes
   */
  useEffect(() => {
    // Preload the most common trigger nodes for better UX
    const commonTriggerNodes = ['chat_input', 'telegram_input'];
    const commonProcessorNodes = ['simple-openai-chat', 'simple-deepseek-chat'];
    
    // Delay preloading to avoid blocking initial render
    const preloadTimer = setTimeout(() => {
      console.debug('Preloading common node components for better UX');
      preloadNodeComponents([...commonTriggerNodes, ...commonProcessorNodes]);
    }, 1000); // 1 second delay
    
    return () => clearTimeout(preloadTimer);
  }, []);

  /**
   * Smart preloading based on user interaction patterns
   * Preloads related components when user interacts with a category
   * 
   * @param category - The category user is interacting with
   * @param nodeTypes - Available node types
   */
  const smartPreload = useCallback((
    category: NodeCategory,
    nodeTypes?: NodeType[]
  ) => {
    // Preload current category
    preloadCategory(category, nodeTypes);
    
    // Smart preloading: load related categories based on common workflows
    const relatedCategories: Record<NodeCategory, NodeCategory[]> = {
      [NodeCategory.TRIGGER]: [NodeCategory.PROCESSOR], // Triggers usually connect to processors
      [NodeCategory.PROCESSOR]: [NodeCategory.ACTION], // Processors usually connect to actions
      [NodeCategory.ACTION]: [], // Actions are usually endpoints
    };
    
    const related = relatedCategories[category] || [];
    related.forEach(relatedCategory => {
      // Delay related preloading to prioritize current category
      setTimeout(() => {
        preloadCategory(relatedCategory, nodeTypes);
      }, 500);
    });
  }, [preloadCategory]);

  return {
    preloadCategory,
    preloadNodes,
    preloadSubcategory,
    smartPreload,
    bundleInfo,
    isComponentLoaded,
  };
};
