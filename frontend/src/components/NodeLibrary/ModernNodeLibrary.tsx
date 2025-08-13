import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  PlayArrow as TriggerIcon,
  Settings as ProcessorIcon,
  Send as ActionIcon,
  AccountCircle as MyModelIcon
} from '@mui/icons-material';

import { NodeType, NodeCategory } from '../../types/nodes';
import { nodeService } from '../../services/nodeService';
import { CategorySidebar } from './CategorySidebar';
import { NodeList } from './NodeList';
import { NodeInfoDialog } from './NodeInfoDialog';
import { useFilteredNodes } from './useFilteredNodes';
import styles from './NodeLibrary.module.css';

interface ModernNodeLibraryProps {
  onNodeDragStart: (event: React.DragEvent, nodeType: NodeType) => void;
}

// Category definitions with colors and icons
const CATEGORIES = [
  {
    id: 'trigger' as NodeCategory,
    name: 'Trigger',
    color: '#10b981',
    icon: TriggerIcon
  },
  {
    id: 'processor' as NodeCategory,
    name: 'Processor', 
    color: '#3b82f6',
    icon: ProcessorIcon
  },
  {
    id: 'action' as NodeCategory,
    name: 'Action',
    color: '#f59e0b',
    icon: ActionIcon
  },
  {
    id: 'my_model' as NodeCategory,
    name: 'My Model',
    color: '#8b5cf6',
    icon: MyModelIcon
  }
];

export const ModernNodeLibrary: React.FC<ModernNodeLibraryProps> = ({ onNodeDragStart }) => {
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory | null>(null);
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [availableNodeTypes, setAvailableNodeTypes] = useState<NodeType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeForInfo, setSelectedNodeForInfo] = useState<NodeType | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

  // Load available node types
  useEffect(() => {
    const loadNodeTypes = async () => {
      try {
        setError(null);
        const nodeTypes = await nodeService.types.getNodeTypes();
        setAvailableNodeTypes(nodeTypes);
      } catch (error) {
        console.error('Failed to load node types:', error);
        setError('Failed to load nodes. Please try again later.');
      }
    };

    loadNodeTypes();
  }, []);

  // Filter and group nodes by category and subcategory
  const filteredAndGroupedNodes = useFilteredNodes(availableNodeTypes, searchQuery, selectedCategory);

  // Get node count for a category
  const getCategoryNodeCount = useCallback((categoryId: NodeCategory) => {
    return availableNodeTypes.filter(node => node.category === categoryId).length;
  }, [availableNodeTypes]);

  // Handle category selection
  const handleCategorySelect = useCallback((categoryId: NodeCategory) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null);
      setExpandedSubcategories(new Set());
    } else {
      setSelectedCategory(categoryId);
    }
  }, [selectedCategory]);

  // Handle subcategory toggle
  const handleSubcategoryToggle = useCallback((subcategory: string) => {
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(subcategory)) {
      newExpanded.delete(subcategory);
    } else {
      newExpanded.add(subcategory);
    }
    setExpandedSubcategories(newExpanded);
  }, [expandedSubcategories]);

  // Handle node info click
  const handleNodeInfoClick = useCallback((nodeType: NodeType) => {
    setSelectedNodeForInfo(nodeType);
    setInfoDialogOpen(true);
  }, []);

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <Box className={styles.modernNodeLibrary}>
      {/* Vertical Category Navigation (Area 1) */}
      <CategorySidebar
        categories={CATEGORIES}
        selectedCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
        getCategoryNodeCount={getCategoryNodeCount}
      />

      {/* Main Content Area (Area 2 & 3) */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header with Search */}
        <Box className={styles.header}>
          <Typography variant="h6" className={styles.title}>
            {selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.name : 'Select Category'}
          </Typography>
          
          {/* Search Bar */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchField}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon className={styles.searchIcon} />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleSearchClear}>
                    <ClearIcon className={styles.clearIcon} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Scrollable Content Area (Area 2) */}
        <Box className={styles.contentArea}>
          {error ? (
            /* Error Message */
            <Box sx={{ p: 4, textAlign: 'center', color: '#ef4444' }}>
              <Typography variant="body2">{error}</Typography>
            </Box>
          ) : !selectedCategory ? (
            /* Welcome Message */
            <Box className={styles.welcomeMessage}>
              <Typography variant="h6" className={styles.welcomeTitle}>
                Select a Category
              </Typography>
              <Typography variant="body2">
                Choose a category from the sidebar to view available nodes
              </Typography>
            </Box>
          ) : (
            <>
              <NodeList
                filteredAndGroupedNodes={filteredAndGroupedNodes}
                selectedCategory={selectedCategory}
                expandedSubcategories={expandedSubcategories}
                onSubcategoryToggle={handleSubcategoryToggle}
                onNodeDragStart={onNodeDragStart}
                onNodeInfoClick={handleNodeInfoClick}
                categories={CATEGORIES}
              />
            </>
          )}
        </Box>
      </Box>

      {/* Node Info Dialog */}
      <NodeInfoDialog
        open={infoDialogOpen}
        onClose={() => setInfoDialogOpen(false)}
        node={selectedNodeForInfo}
        categories={CATEGORIES}
      />
    </Box>
  );
};
