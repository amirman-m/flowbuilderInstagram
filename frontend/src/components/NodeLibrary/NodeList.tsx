import React from 'react';
import { Box, Typography, Chip, Collapse, Paper, IconButton, Tooltip } from '@mui/material';
import { Info as InfoIcon, ExpandLess, ExpandMore, Code as CodeIcon } from '@mui/icons-material';
import { NodeCategory, NodeType } from '../../types/nodes';

export type CategoryItem = {
  id: NodeCategory;
  name: string;
  color: string;
  icon: React.ElementType;
};

interface NodeListProps {
  filteredAndGroupedNodes: Record<string, NodeType[]>;
  selectedCategory: NodeCategory | null;
  expandedSubcategories: Set<string>;
  onSubcategoryToggle: (subcategory: string) => void;
  onNodeDragStart: (event: React.DragEvent, nodeType: NodeType) => void;
  onNodeInfoClick: (nodeType: NodeType) => void;
  categories: CategoryItem[];
}

export const NodeList: React.FC<NodeListProps> = ({
  filteredAndGroupedNodes,
  selectedCategory,
  expandedSubcategories,
  onSubcategoryToggle,
  onNodeDragStart,
  onNodeInfoClick,
  categories,
}) => {
  const getCategoryColor = (categoryId: NodeCategory) =>
    categories.find((c) => c.id === categoryId)?.color || '#9ca3af';

  return (
    <Box sx={{ p: 1 }}>
      {Object.entries(filteredAndGroupedNodes).map(([subcategory, nodes]) => (
        <Box key={subcategory} sx={{ mb: 1 }}>
          {/* Subcategory Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 1.5,
              cursor: 'pointer',
              borderRadius: 1,
              backgroundColor: '#1e1e1e',
              border: '1px solid #404040',
              mb: 1,
              '&:hover': {
                backgroundColor: '#252525',
                borderColor: '#525252',
              },
            }}
            onClick={() => onSubcategoryToggle(subcategory)}
          >
            <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 600, color: '#f1f5f9' }}>
              {subcategory}
            </Typography>
            <Chip
              label={nodes.length}
              size="small"
              sx={{ mr: 1, minWidth: 24, height: 20, backgroundColor: '#404040', color: '#f1f5f9' }}
            />
            {expandedSubcategories.has(subcategory) ? (
              <ExpandLess sx={{ color: '#9ca3af' }} />
            ) : (
              <ExpandMore sx={{ color: '#9ca3af' }} />
            )}
          </Box>

          {/* Nodes in Subcategory */}
          <Collapse in={expandedSubcategories.has(subcategory)} timeout="auto" unmountOnExit>
            <Box>
              {nodes.map((node) => (
                <Paper
                  key={node.id}
                  draggable
                  onDragStart={(event) => onNodeDragStart(event, node)}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    cursor: 'grab',
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #404040',
                    borderRadius: 1,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: '#252525',
                      borderColor: '#525252',
                      transform: 'translateX(4px)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    },
                    '&:active': {
                      cursor: 'grabbing',
                      transform: 'scale(0.98) translateX(4px)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        backgroundColor: `${getCategoryColor(selectedCategory as NodeCategory)}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: getCategoryColor(selectedCategory as NodeCategory),
                      }}
                    >
                      <CodeIcon />
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" sx={{ color: '#f1f5f9' }}>
                        {node.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                        {node.category}
                      </Typography>
                    </Box>
                    <Tooltip title="Node details">
                      <IconButton size="small" onClick={() => onNodeInfoClick(node)}>
                        <InfoIcon sx={{ fontSize: 18, color: '#9ca3af' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Collapse>
        </Box>
      ))}

      {Object.keys(filteredAndGroupedNodes).length === 0 && (
        <Box sx={{ p: 4, textAlign: 'center', color: '#9ca3af' }}>
          <Typography variant="body2">
            No nodes available in this category.
          </Typography>
        </Box>
      )}
    </Box>
  );
};
