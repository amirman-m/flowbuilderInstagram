import React from 'react';
import { Box, Stack, Typography, Tooltip, IconButton } from '@mui/material';
import { NodeCategory } from '../../types/nodes';

type CategoryItem = {
  id: NodeCategory;
  name: string;
  color: string;
  icon: React.ElementType;
};

interface CategorySidebarProps {
  categories: CategoryItem[];
  selectedCategory: NodeCategory | null;
  onCategorySelect: (categoryId: NodeCategory) => void;
  getCategoryNodeCount: (categoryId: NodeCategory) => number;
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  selectedCategory,
  onCategorySelect,
  getCategoryNodeCount,
}) => {
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
          const isActive = selectedCategory === category.id;
          const Icon = category.icon;
          const nodeCount = getCategoryNodeCount(category.id);
          return (
            <Tooltip key={category.id} title={`${category.name} (${nodeCount})`} placement="right">
              <IconButton
                onClick={() => onCategorySelect(category.id)}
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
