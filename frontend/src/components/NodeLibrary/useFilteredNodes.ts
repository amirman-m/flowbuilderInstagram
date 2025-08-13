import { useMemo } from 'react';
import { NodeType, NodeCategory } from '../../types/nodes';
import { NODE_REGISTRY } from '../../config/nodeRegistry';

/**
 * Custom hook to filter and group node types based on search query and selected category
 * @param nodeTypes - Array of available node types
 * @param searchQuery - Search term to filter nodes by
 * @param selectedCategory - Selected category to filter nodes by
 * @returns Object with nodes grouped by subcategory
 */
export const useFilteredNodes = (
  nodeTypes: NodeType[],
  searchQuery: string,
  selectedCategory: NodeCategory | null
) => {
  return useMemo(() => {
    // Start with all node types
    let filtered = nodeTypes;
    
    // Apply search filter if query exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(node => 
        // Match node name, description, or subcategory
        node.name.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query) ||
        (NODE_REGISTRY[node.id]?.subcategory.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter if category is selected
    if (selectedCategory) {
      filtered = filtered.filter(node => node.category === selectedCategory);
    }
    
    // Group nodes by subcategory using registry data
    const grouped = filtered.reduce((acc, node) => {
      // Get subcategory from registry or default to 'General'
      const registryInfo = NODE_REGISTRY[node.id];
      const subcategory = registryInfo?.subcategory || 'General';
      
      // Log warning for missing registry entries in development
      if (!registryInfo && import.meta.env?.DEV) {
        console.warn(`Missing NODE_REGISTRY entry for node ID: ${node.id}`);
      }
      
      // Initialize subcategory array if it doesn't exist
      if (!acc[subcategory]) {
        acc[subcategory] = [];
      }
      
      // Add node to its subcategory
      acc[subcategory].push(node);
      return acc;
    }, {} as Record<string, NodeType[]>);
    
    return grouped;
  }, [nodeTypes, searchQuery, selectedCategory]);
};
