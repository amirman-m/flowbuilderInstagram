import React from 'react';
import { Box, Stack, Typography, Tooltip, IconButton } from '@mui/material';
import { NodeCategory } from '../../types/nodes';
import { CategoryItem } from '../../config/categories';

/**
 * Props interface for CategorySidebar component with comprehensive validation
 */
interface CategorySidebarProps {
  /** Array of category items to display. Must not be null/undefined. */
  categories: CategoryItem[];
  /** Currently selected category ID, null if none selected */
  selectedCategory: NodeCategory | null;
  /** Callback function when a category is selected. Must be provided. */
  onCategorySelect: (categoryId: NodeCategory) => void;
  /** Function to get node count for a category. Must return a non-negative number. */
  getCategoryNodeCount: (categoryId: NodeCategory) => number;
}

/**
 * Renders a vertical sidebar with category buttons for node selection in the flow builder.
 * 
 * This component displays a list of node categories with visual indicators for the number
 * of nodes in each category. It provides an intuitive interface for users to filter nodes
 * by category type (triggers, processors, actions).
 * 
 * @component
 * @example
 * ```tsx
 * import { CategorySidebar } from './CategorySidebar';
 * import { categories } from '../../config/categories';
 * 
 * function MyComponent() {
 *   const [selectedCategory, setSelectedCategory] = useState<NodeCategory | null>(null);
 *   
 *   const handleCategorySelect = (categoryId: NodeCategory) => {
 *     setSelectedCategory(categoryId);
 *   };
 *   
 *   const getNodeCount = (categoryId: NodeCategory) => {
 *     return nodeRegistry.getNodesByCategory(categoryId).length;
 *   };
 *   
 *   return (
 *     <CategorySidebar
 *       categories={categories}
 *       selectedCategory={selectedCategory}
 *       onCategorySelect={handleCategorySelect}
 *       getCategoryNodeCount={getNodeCount}
 *     />
 *   );
 * }
 * ```
 * 
 * @param props - The component props
 * @param props.categories - Array of category items to display with icons and colors
 * @param props.selectedCategory - Currently selected category ID or null if none selected
 * @param props.onCategorySelect - Callback function invoked when a category is selected
 * @param props.getCategoryNodeCount - Function that returns the number of nodes in a given category
 * @returns A React functional component that renders the category sidebar
 * 
 * @since 1.0.0
 * @author Social Media Flow Builder Team
 */
export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories = [],
  selectedCategory = null,
  onCategorySelect = () => {
    console.warn('CategorySidebar: onCategorySelect callback not provided');
  },
  getCategoryNodeCount = () => {
    console.warn('CategorySidebar: getCategoryNodeCount function not provided');
    return 0;
  },
}) => {
  // Validate categories prop
  if (!Array.isArray(categories)) {
    console.error('CategorySidebar: categories prop must be an array');
    return null;
  }

  // Validate callback functions
  if (typeof onCategorySelect !== 'function') {
    console.error('CategorySidebar: onCategorySelect must be a function');
    return null;
  }

  if (typeof getCategoryNodeCount !== 'function') {
    console.error('CategorySidebar: getCategoryNodeCount must be a function');
    return null;
  }
  return (
    <Box
      className="category-sidebar"
      sx={{
        width: 80,
        borderRight: '1px solid #404040',
        p: 1.5,
        backgroundColor: '#1e1e1e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: '#9ca3af', fontWeight: 600 }}>
        Categories
      </Typography>

      <Stack spacing={1} sx={{ width: '100%', alignItems: 'center' }}>
        {categories.map((category) => {
          // Validate individual category structure
          if (!category || typeof category !== 'object') {
            console.warn('CategorySidebar: Invalid category object:', category);
            return null;
          }

          if (!category.id || !category.name || !category.icon) {
            console.warn('CategorySidebar: Category missing required fields:', category);
            return null;
          }

          const isActive = selectedCategory === category.id;
          const Icon = category.icon;
          let nodeCount = 0;
          
          try {
            nodeCount = getCategoryNodeCount(category.id);
            // Ensure nodeCount is a valid non-negative number
            if (typeof nodeCount !== 'number' || nodeCount < 0 || !Number.isFinite(nodeCount)) {
              console.warn(`CategorySidebar: Invalid node count for category ${category.id}:`, nodeCount);
              nodeCount = 0;
            }
          } catch (error) {
            console.error(`CategorySidebar: Error getting node count for category ${category.id}:`, error);
            nodeCount = 0;
          }
          return (
            <Tooltip key={category.id} title={`${category.name} (${nodeCount})`} placement="right">
              <IconButton
                onClick={() => {
                  try {
                    onCategorySelect(category.id);
                  } catch (error) {
                    console.error('CategorySidebar: Error in onCategorySelect callback:', error);
                  }
                }}
                sx={{
                  width: 48,
                  height: 48,
                  backgroundColor: isActive ? category.color : 'transparent',
                  color: isActive ? '#ffffff' : '#9ca3af',
                  border: isActive ? 'none' : '1px solid #404040',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  position: 'relative',
                  '&:hover': {
                    backgroundColor: isActive ? category.color : '#404040',
                    color: '#ffffff',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                  }
                }}
              >
                <Icon sx={{ fontSize: 20 }} />
                {nodeCount > 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      backgroundColor: category.color,
                      color: 'white',
                      borderRadius: '50%',
                      width: 16,
                      height: 16,
                      fontSize: '0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600
                    }}
                  >
                    {nodeCount}
                  </Box>
                )}
              </IconButton>
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
};
