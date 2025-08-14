import React from 'react';
import { Box, Stack, Typography, Tooltip, IconButton } from '@mui/material';
import { NodeCategory } from '../../types/nodes';
import { CategoryItem } from '../../config/categories';
import { 
  validateCategorySidebarProps, 
  safeCallback, 
  validateNodeCount,
  devValidateProps 
} from './validation';
import { NodeCount } from './types';

/**
 * Props interface for CategorySidebar component with comprehensive validation
 * Enhanced with strict type safety and edge case handling
 */
interface CategorySidebarProps {
  /** Array of category items to display. Must not be null/undefined. */
  categories: readonly CategoryItem[];
  /** Currently selected category ID, null if none selected */
  selectedCategory: NodeCategory | null;
  /** Callback function when a category is selected. Must be provided. */
  onCategorySelect: (categoryId: NodeCategory) => void;
  /** Function to get node count for a category. Must return a non-negative number. */
  getCategoryNodeCount: (categoryId: NodeCategory) => NodeCount;
  /** Optional accessibility label for the sidebar */
  ariaLabel?: string;
  /** Optional test ID for testing */
  testId?: string;
  /** Optional maximum categories to display */
  maxCategories?: number;
  /** Optional loading state */
  isLoading?: boolean;
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
  onCategorySelect,
  getCategoryNodeCount,
  ariaLabel = 'Node categories',
  testId = 'category-sidebar',
  maxCategories = 20,
  isLoading = false,
}) => {
  // Development-only prop validation
  devValidateProps({ categories, selectedCategory, onCategorySelect, getCategoryNodeCount }, validateCategorySidebarProps, 'CategorySidebar');
  
  // Create safe callbacks with error handling
  const safeCategorySelect = safeCallback(onCategorySelect, 'onCategorySelect', 'CategorySidebar');
  const safeGetNodeCount = safeCallback(getCategoryNodeCount, 'getCategoryNodeCount', 'CategorySidebar');
  // Runtime validation with graceful error handling
  if (!Array.isArray(categories)) {
    console.error('CategorySidebar: categories prop must be an array');
    return (
      <Box sx={{ p: 2, color: 'error.main' }}>
        <Typography variant="caption">Invalid categories data</Typography>
      </Box>
    );
  }

  if (categories.length === 0 && !isLoading) {
    return (
      <Box sx={{ p: 2, color: 'text.secondary' }}>
        <Typography variant="caption">No categories available</Typography>
      </Box>
    );
  }
  
  // Apply maximum categories limit
  const displayCategories = categories.slice(0, maxCategories);
  
  if (categories.length > maxCategories) {
    console.warn(`CategorySidebar: Displaying ${maxCategories} of ${categories.length} categories`);
  }
  return (
    <Box
      className="category-sidebar"
      aria-label={ariaLabel}
      data-testid={testId}
      role="navigation"
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
        {isLoading ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Loading categories...
            </Typography>
          </Box>
        ) : (
          displayCategories.map((category) => {
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
          // Get validated node count with error handling
          const nodeCount = validateNodeCount(
            safeGetNodeCount(category.id), 
            `CategorySidebar for category ${category.id}`
          );
          return (
            <Tooltip key={category.id} title={`${category.name} (${nodeCount})`} placement="right">
              <IconButton
                onClick={() => safeCategorySelect(category.id)}
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
          })
        )}
      </Stack>
    </Box>
  );
};
