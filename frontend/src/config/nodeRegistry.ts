// Central registry for node metadata
import { NodeCategory } from '../types/nodes';
export const NODE_REGISTRY: Record<string, { category: NodeCategory; subcategory: string }> = {
    "simple-openai-chat": {
      category: NodeCategory.PROCESSOR,
      subcategory: "Chat Models"
    },
    "simple-deepseek-chat": {
      category: NodeCategory.PROCESSOR,
      subcategory: "Chat Models"
    },
    // Add more nodes here in the future
    "example-action-node": {
      category: NodeCategory.ACTION,
      subcategory: "Social Media"
    }
  };