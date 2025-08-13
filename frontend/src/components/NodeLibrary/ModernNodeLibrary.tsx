import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Button,
  IconButton
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import { NodeCategory, NodeType } from '../../types/nodes';
import { nodeService } from '../../services/nodeService';
import { useFilteredNodes } from './useFilteredNodes';
import { useSnackbar } from '../SnackbarProvider';
import { errorService } from '../../services/errorService';
import { CategorySidebar } from './CategorySidebar';
import { NodeList } from './NodeList';
import { NodeInfoDialog } from './NodeInfoDialog';
import { CATEGORIES } from '../../config/categories';
import styles from './ModernNodeLibrary.module.css';

interface ModernNodeLibraryProps {
  onNodeDragStart: (event: React.DragEvent, nodeType: NodeType) => void;
}

export const ModernNodeLibrary: React.FC<ModernNodeLibraryProps> = ({ onNodeDragStart }) => {
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory | null>(null);
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [availableNodeTypes, setAvailableNodeTypes] = useState<NodeType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { showSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [selectedNodeForInfo, setSelectedNodeForInfo] = useState<NodeType | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

  // Custom debounce function
  const debounce = <T extends (...args: any[]) => any>(func: T, wait: number) => {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Debounced search function
  const debouncedSetSearchQuery = useCallback(
    debounce((value: string) => setDebouncedSearchQuery(value), 300),
    []
  );

  // Load available node types with enhanced error handling and retry logic
  const loadNodeTypes = useCallback(async (isRetry: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use retry logic from error service
      const nodeTypes = await errorService.withRetry(
        () => nodeService.types.getNodeTypes(),
        3, // max retries
        1000, // initial delay
        { component: 'ModernNodeLibrary', action: 'loadNodeTypes', isRetry }
      );
      
      setAvailableNodeTypes(nodeTypes);
      setRetryCount(0);
      
      // Show success message on retry
      if (isRetry) {
        showSnackbar({
          message: 'Node types loaded successfully!',
          severity: 'success'
        });
      }
      
    } catch (error) {
      const originalError = error as Error;
      
      // Create structured error
      const appError = errorService.createAPIError(
        `Failed to load node types: ${originalError.message}`,
        originalError,
        {
          component: 'ModernNodeLibrary',
          action: 'loadNodeTypes',
          retryCount,
          nodeTypesCount: availableNodeTypes.length
        }
      );
      
      // Log error to centralized service
      errorService.logError(appError);
      
      // Set user-friendly error message
      const userMessage = errorService.getUserFriendlyMessage(appError);
      setError(userMessage);
      setRetryCount(prev => prev + 1);
      
      // Show snackbar notification
      showSnackbar(errorService.toSnackbarOptions(appError));
      
    } finally {
      setLoading(false);
    }
  }, [showSnackbar, retryCount, availableNodeTypes.length]);

  // Load node types on component mount
  useEffect(() => {
    loadNodeTypes();
  }, [loadNodeTypes]);

  // Filter and group nodes by category and subcategory
  const filteredAndGroupedNodes = useFilteredNodes(availableNodeTypes, debouncedSearchQuery, selectedCategory);

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
    setDebouncedSearchQuery('');
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
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              debouncedSetSearchQuery(e.target.value);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSearchQuery('');
                      setDebouncedSearchQuery('');
                    }}
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            className={styles.searchInput}
          />
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            className={styles.errorAlert}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => loadNodeTypes(true)}
                disabled={loading}
              >
                {loading ? 'Retrying...' : `Retry${retryCount > 0 ? ` (${retryCount})` : ''}`}
              </Button>
            }
          >
            <Box>
              <Typography variant="body2" component="div">
                {error}
              </Typography>
              {retryCount > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Retry attempt: {retryCount}
                </Typography>
              )}
            </Box>
          </Alert>
        )}

        {/* Content Area */}
        <Box className={styles.content}>
          {loading ? (
            <Box className={styles.loadingContainer}>
              <CircularProgress size={40} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Loading node types...
              </Typography>
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
            <NodeList
              filteredAndGroupedNodes={filteredAndGroupedNodes}
              selectedCategory={selectedCategory}
              expandedSubcategories={expandedSubcategories}
              onSubcategoryToggle={handleSubcategoryToggle}
              onNodeDragStart={onNodeDragStart}
              onNodeInfoClick={handleNodeInfoClick}
              categories={CATEGORIES}
            />
          )}
        </Box>
      </Box>

      {/* Node Info Dialog */}
      <NodeInfoDialog
        node={selectedNodeForInfo}
        open={infoDialogOpen}
        onClose={() => setInfoDialogOpen(false)}
        categories={CATEGORIES}
      />
    </Box>
  );
};
