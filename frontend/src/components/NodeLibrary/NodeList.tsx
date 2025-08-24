import React from 'react';
import { Box, Typography, Chip, Collapse, Paper, IconButton, Tooltip } from '@mui/material';
import { Info as InfoIcon, ExpandLess, ExpandMore } from '@mui/icons-material';
import { NodeCategory, NodeType } from '../../types/nodes';
import { CategoryItem } from '../../config/categories';
import { renderNodeIcon } from '../../config/nodeIcons';
import styles from './NodeList.module.css';

/**
 * Props interface for NodeList component with comprehensive validation
 */
interface NodeListProps {
  /** Filtered and grouped nodes by subcategory. Must be a valid object. */
  filteredAndGroupedNodes: Record<string, NodeType[]>;
  /** Currently selected category ID, null if none selected */
  selectedCategory: NodeCategory | null;
  /** Set of expanded subcategory names */
  expandedSubcategories: Set<string>;
  /** Callback when subcategory is toggled. Must be provided. */
  onSubcategoryToggle: (subcategory: string) => void;
  /** Callback when node drag starts. Must be provided. */
  onNodeDragStart: (event: React.DragEvent, nodeType: NodeType) => void;
  /** Callback when node info is clicked. Must be provided. */
  onNodeInfoClick: (nodeType: NodeType) => void;
  /** Array of category items for color mapping. Must not be null/undefined. */
  categories: CategoryItem[];
}

/**
 * Renders a collapsible list of nodes organized by subcategories with drag-and-drop functionality.
 * 
 * This component displays filtered nodes grouped by subcategories in an accordion-style layout.
 * Each node can be dragged to the flow canvas and includes an info button for detailed information.
 * Subcategories can be expanded/collapsed and show node counts as badges.
 * 
 * @component
 * @example
 * ```tsx
 * import { NodeList } from './NodeList';
 * import { NodeType, NodeCategory } from '../../types/nodes';
 * 
 * function MyComponent() {
 *   const [expandedSubcategories, setExpandedSubcategories] = useState(new Set<string>());
 *   const filteredNodes = { 'AI Models': [openAINode, deepSeekNode], 'Input': [chatInputNode] };
 *   
 *   const handleSubcategoryToggle = (subcategory: string) => {
 *     const newExpanded = new Set(expandedSubcategories);
 *     if (newExpanded.has(subcategory)) {
 *       newExpanded.delete(subcategory);
 *     } else {
 *       newExpanded.add(subcategory);
 *     }
 *     setExpandedSubcategories(newExpanded);
 *   };
 *   
 *   const handleNodeDragStart = (event: React.DragEvent, nodeType: NodeType) => {
 *     event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType));
 *   };
 *   
 *   const handleNodeInfoClick = (nodeType: NodeType) => {
 *     setSelectedNode(nodeType);
 *     setInfoDialogOpen(true);
 *   };
 *   
 *   return (
 *     <NodeList
 *       filteredAndGroupedNodes={filteredNodes}
 *       selectedCategory='trigger'
 *       expandedSubcategories={expandedSubcategories}
 *       onSubcategoryToggle={handleSubcategoryToggle}
 *       onNodeDragStart={handleNodeDragStart}
 *       onNodeInfoClick={handleNodeInfoClick}
 *       categories={categories}
 *     />
 *   );
 * }
 * ```
 * 
 * @param props - The component props
 * @param props.filteredAndGroupedNodes - Object mapping subcategory names to arrays of NodeType objects
 * @param props.selectedCategory - Currently selected category ID for color theming
 * @param props.expandedSubcategories - Set of subcategory names that are currently expanded
 * @param props.onSubcategoryToggle - Callback invoked when a subcategory header is clicked to expand/collapse
 * @param props.onNodeDragStart - Callback invoked when a node drag operation begins
 * @param props.onNodeInfoClick - Callback invoked when the info button on a node is clicked
 * @param props.categories - Array of category items used for color mapping and theming
 * @returns A React functional component that renders the expandable node list
 * 
 * @since 1.0.0
 * @author Social Media Flow Builder Team
 */
export const NodeList: React.FC<NodeListProps> = ({
  filteredAndGroupedNodes = {},
  selectedCategory = null,
  expandedSubcategories = new Set<string>(),
  onSubcategoryToggle = (subcategory: string) => {
    console.warn('NodeList: onSubcategoryToggle callback not provided for:', subcategory);
  },
  onNodeDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    console.warn('NodeList: onNodeDragStart callback not provided for:', nodeType.name);
  },
  onNodeInfoClick = (nodeType: NodeType) => {
    console.warn('NodeList: onNodeInfoClick callback not provided for:', nodeType.name);
  },
  categories = [],
}) => {
  // Validate props
  if (!filteredAndGroupedNodes || typeof filteredAndGroupedNodes !== 'object') {
    console.error('NodeList: filteredAndGroupedNodes must be a valid object');
    return null;
  }

  if (!Array.isArray(categories)) {
    console.error('NodeList: categories prop must be an array');
    return null;
  }

  if (!(expandedSubcategories instanceof Set)) {
    console.error('NodeList: expandedSubcategories must be a Set');
    return null;
  }

  if (typeof onSubcategoryToggle !== 'function') {
    console.error('NodeList: onSubcategoryToggle must be a function');
    return null;
  }

  if (typeof onNodeDragStart !== 'function') {
    console.error('NodeList: onNodeDragStart must be a function');
    return null;
  }

  if (typeof onNodeInfoClick !== 'function') {
    console.error('NodeList: onNodeInfoClick must be a function');
    return null;
  }
  const getCategoryColor = (categoryId: NodeCategory) => {
    try {
      if (!categoryId) return '#9ca3af';
      const category = categories.find((c) => c && c.id === categoryId);
      return category?.color || '#9ca3af';
    } catch (error) {
      console.warn('NodeList: Error getting category color for:', categoryId, error);
      return '#9ca3af';
    }
  };

  return (
    <Box className={styles.nodeListContainer}>
      {Object.entries(filteredAndGroupedNodes).map(([subcategory, nodes]) => {
        // Validate subcategory data
        if (!subcategory || typeof subcategory !== 'string') {
          console.warn('NodeList: Invalid subcategory name:', subcategory);
          return null;
        }

        if (!Array.isArray(nodes)) {
          console.warn('NodeList: Nodes must be an array for subcategory:', subcategory);
          return null;
        }

        return (
        <Box key={subcategory} className={styles.subcategoryContainer}>
          {/* Subcategory Header */}
          <Box
            className={styles.subcategoryHeader}
            onClick={() => {
              try {
                onSubcategoryToggle(subcategory);
              } catch (error) {
                console.error('NodeList: Error in onSubcategoryToggle callback:', error);
              }
            }}
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
              {nodes.map((node) => {
                // Validate individual node structure
                if (!node || typeof node !== 'object') {
                  console.warn('NodeList: Invalid node object:', node);
                  return null;
                }

                if (!node.id || !node.name) {
                  console.warn('NodeList: Node missing required fields:', node);
                  return null;
                }

                return (
                <Paper
                  key={node.id}
                  draggable
                  onDragStart={(event) => {
                    try {
                      onNodeDragStart(event, node);
                    } catch (error) {
                      console.error('NodeList: Error in onNodeDragStart callback:', error);
                    }
                  }}
                  className={styles.nodePaper}
                >
                  <Box className={styles.nodeContent}>
                    <Box
                      className={styles.nodeIconWrapper}
                      style={{ backgroundColor: `${getCategoryColor(selectedCategory as NodeCategory)}20` }}
                    >
                      {renderNodeIcon(node.id, {
                        className: styles.nodeIcon,
                        style: { color: getCategoryColor(selectedCategory as NodeCategory) }
                      })}
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
                      <IconButton size="small" onClick={() => {
                        try {
                          onNodeInfoClick(node);
                        } catch (error) {
                          console.error('NodeList: Error in onNodeInfoClick callback:', error);
                        }
                      }}>
                        <InfoIcon className={styles.infoIcon} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
                );
              })}
            </Box>
          </Collapse>
        </Box>
        );
      })}

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
