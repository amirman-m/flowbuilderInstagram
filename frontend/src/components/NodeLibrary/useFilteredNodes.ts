import { useMemo } from 'react';
import { NodeType, NodeCategory } from '../../types/nodes';
import { NODE_REGISTRY } from '../../config/nodeRegistry';

export const useFilteredNodes = (
  nodeTypes: NodeType[],
  searchQuery: string,
  selectedCategory: NodeCategory | null
) => {
  return useMemo(() => {
    let filtered = nodeTypes;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(node => 
        node.name.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query) ||
        (NODE_REGISTRY[node.id]?.subcategory.toLowerCase().includes(query))
      );
    }
    
    if (selectedCategory) {
      filtered = filtered.filter(node => node.category === selectedCategory);
    }
    
    const grouped = filtered.reduce((acc, node) => {
      const registryInfo = NODE_REGISTRY[node.id];
      const subcategory = registryInfo?.subcategory || 'General';
      if (!acc[subcategory]) {
        acc[subcategory] = [];
      }
      acc[subcategory].push(node);
      return acc;
    }, {} as Record<string, NodeType[]>);
    
    return grouped;
  }, [nodeTypes, searchQuery, selectedCategory]);
};
