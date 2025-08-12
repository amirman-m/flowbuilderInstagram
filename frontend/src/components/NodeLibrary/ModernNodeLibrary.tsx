import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Info as InfoIcon,
  PlayArrow as TriggerIcon,
  Settings as ProcessorIcon,
  Send as ActionIcon,
  AccountCircle as MyModelIcon,
  ExpandLess,
  ExpandMore,
  Code as CodeIcon,
  Input as InputIcon,
  Output as OutputIcon
} from '@mui/icons-material';

import { NodeType, NodeCategory } from '../../types/nodes';
import { nodeService } from '../../services/nodeService';
import { NODE_REGISTRY } from '../../config/nodeRegistry';
import { CategorySidebar } from './CategorySidebar';
import { NodeList } from './NodeList';
import { NodeInfoDialog } from './NodeInfoDialog';
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
  const [loading, setLoading] = useState(true);
  const [selectedNodeForInfo, setSelectedNodeForInfo] = useState<NodeType | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

  // Load available node types
  useEffect(() => {
    const loadNodeTypes = async () => {
      try {
        setLoading(true);
        const nodeTypes = await nodeService.types.getNodeTypes();
        setAvailableNodeTypes(nodeTypes);
      } catch (error) {
        console.error('Failed to load node types:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNodeTypes();
  }, []);

  // Filter and group nodes by category and subcategory
  const filteredAndGroupedNodes = useMemo(() => {
    let filtered = availableNodeTypes;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(node => 
        node.name.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query) ||
        (NODE_REGISTRY[node.id]?.subcategory.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(node => node.category === selectedCategory);
    }
    
    // Group by subcategory using registry data
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
  }, [availableNodeTypes, searchQuery, selectedCategory]);

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
          {!selectedCategory ? (
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
