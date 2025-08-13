import React from 'react';
import { Box, Typography, Chip, Collapse, Paper, IconButton, Tooltip } from '@mui/material';
import { Info as InfoIcon, ExpandLess, ExpandMore, Code as CodeIcon } from '@mui/icons-material';
import { NodeCategory, NodeType } from '../../types/nodes';
import { CategoryItem } from '../../config/categories';
import styles from './NodeLibrary.module.css';

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
    <Box className={styles.nodeListContainer}>
      {Object.entries(filteredAndGroupedNodes).map(([subcategory, nodes]) => (
        <Box key={subcategory} className={styles.subcategoryContainer}>
          {/* Subcategory Header */}
          <Box
            className={styles.subcategoryHeader}
            onClick={() => onSubcategoryToggle(subcategory)}
          >
            <Typography variant="subtitle2" className={styles.subcategoryTitle}>
              {subcategory}
            </Typography>
            <Chip
              label={nodes.length}
              size="small"
              className={styles.subcategoryChip}
            />
            {expandedSubcategories.has(subcategory) ? (
              <ExpandLess className={styles.expandIcon} />
            ) : (
              <ExpandMore className={styles.expandIcon} />
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
                  className={styles.nodePaper}
                >
                  <Box className={styles.nodeContent}>
                    <Box
                      className={styles.nodeIconWrapper}
                      style={{ backgroundColor: `${getCategoryColor(selectedCategory as NodeCategory)}20` }}
                    >
                      <CodeIcon className={styles.nodeIcon} style={{ color: getCategoryColor(selectedCategory as NodeCategory) }} />
                    </Box>
                    <Box className={styles.nodeDetails}>
                      <Typography variant="subtitle2" className={styles.nodeName}>
                        {node.name}
                      </Typography>
                      <Typography variant="caption" className={styles.nodeCategory}>
                        {node.category}
                      </Typography>
                    </Box>
                    <Tooltip title="Node details">
                      <IconButton size="small" onClick={() => onNodeInfoClick(node)}>
                        <InfoIcon className={styles.infoIcon} />
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
        <Box className={styles.emptyState}>
          <Typography variant="body2">
            No nodes available in this category.
          </Typography>
        </Box>
      )}
    </Box>
  );
};
