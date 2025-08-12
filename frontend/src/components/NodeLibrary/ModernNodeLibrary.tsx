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
        (node.subcategory && node.subcategory.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(node => node.category === selectedCategory);
    }
    
    // Group by subcategory
    const grouped = filtered.reduce((acc, node) => {
      const subcategory = node.subcategory || 'General';
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
    <Box className="modern-node-library" sx={{ height: '100%', display: 'flex', backgroundColor: '#2a2a2a' }}>
      {/* Vertical Category Navigation (Area 1) */}
      <Box 
        className="category-sidebar"
        sx={{ 
          width: 80, 
          backgroundColor: '#1e1e1e', 
          borderRight: '1px solid #404040',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 2
        }}
      >
        {/* Toolbox Title */}
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#9ca3af', 
            mb: 3, 
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          Toolbox
        </Typography>

        {/* Category Icons */}
        <Stack spacing={1} sx={{ width: '100%', alignItems: 'center' }}>
          {CATEGORIES.map((category) => {
            const isActive = selectedCategory === category.id;
            const Icon = category.icon;
            const nodeCount = getCategoryNodeCount(category.id);
            return (
              <Tooltip key={category.id} title={`${category.name} (${nodeCount})`} placement="right">
                <IconButton
                  onClick={() => handleCategorySelect(category.id)}
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

      {/* Main Content Area (Area 2 & 3) */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header with Search */}
        <Box sx={{ p: 2, borderBottom: '1px solid #404040', backgroundColor: '#2a2a2a' }}>
          <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, color: '#f1f5f9' }}>
            {selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.name : 'Select Category'}
          </Typography>
          
          {/* Search Bar */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9ca3af', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleSearchClear}>
                    <ClearIcon sx={{ fontSize: 16, color: '#9ca3af' }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#1e1e1e',
                border: '1px solid #404040',
                borderRadius: 2,
                color: '#f1f5f9',
                '&:hover': {
                  backgroundColor: '#252525',
                  borderColor: '#525252',
                },
                '&.Mui-focused': {
                  backgroundColor: '#1e1e1e',
                  borderColor: '#3b82f6',
                  boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.1)'
                },
                '& fieldset': {
                  border: 'none'
                }
              },
              '& .MuiInputBase-input::placeholder': {
                color: '#6b7280'
              }
            }}
          />
        </Box>

        {/* Scrollable Content Area (Area 2) */}
        <Box 
          sx={{ 
            flexGrow: 1, 
            overflow: 'auto', 
            backgroundColor: '#2a2a2a',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#1e1e1e',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#525252',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#6b7280',
            }
          }}
        >
          {!selectedCategory ? (
            /* Welcome Message */
            <Box sx={{ 
              p: 4, 
              textAlign: 'center',
              color: '#9ca3af'
            }}>
              <Typography variant="h6" sx={{ mb: 1, color: '#d1d5db' }}>
                Select a Category
              </Typography>
              <Typography variant="body2">
                Choose a category from the sidebar to view available nodes
              </Typography>
            </Box>
          ) : (
            /* Subcategories and Nodes */
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
                        borderColor: '#525252'
                      }
                    }}
                    onClick={() => handleSubcategoryToggle(subcategory)}
                  >
                    <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 600, color: '#f1f5f9' }}>
                      {subcategory}
                    </Typography>
                    <Chip
                      label={nodes.length}
                      size="small"
                      sx={{ 
                        mr: 1, 
                        minWidth: 24, 
                        height: 20,
                        backgroundColor: CATEGORIES.find(c => c.id === selectedCategory)?.color,
                        color: 'white',
                        fontSize: '0.7rem'
                      }}
                    />
                    {expandedSubcategories.has(subcategory) ? 
                      <ExpandLess sx={{ color: '#9ca3af' }} /> : 
                      <ExpandMore sx={{ color: '#9ca3af' }} />
                    }
                  </Box>

                  {/* Node List */}
                  <Collapse in={expandedSubcategories.has(subcategory)}>
                    <Box sx={{ pl: 1 }}>
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
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                            },
                            '&:active': {
                              cursor: 'grabbing',
                              transform: 'scale(0.98) translateX(4px)'
                            }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: 1,
                                backgroundColor: `${CATEGORIES.find(c => c.id === selectedCategory)?.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: CATEGORIES.find(c => c.id === selectedCategory)?.color
                              }}
                            >
                              <CodeIcon sx={{ fontSize: 16 }} />
                            </Box>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#f1f5f9', mb: 0.5 }}>
                                {node.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                                {node.description.length > 50 ? `${node.description.substring(0, 50)}...` : node.description}
                              </Typography>
                            </Box>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNodeInfoClick(node);
                              }}
                              sx={{
                                color: '#9ca3af',
                                '&:hover': {
                                  color: '#f1f5f9',
                                  backgroundColor: '#404040'
                                }
                              }}
                            >
                              <InfoIcon sx={{ fontSize: 16 }} />
                            </IconButton>
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
                    {searchQuery ? 'No nodes found matching your search.' : 'No nodes available in this category.'}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Node Info Dialog */}
      <Dialog
        open={infoDialogOpen}
        onClose={() => setInfoDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1e1e1e',
            border: '1px solid #404040',
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ color: '#f1f5f9', borderBottom: '1px solid #404040' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                backgroundColor: selectedNodeForInfo ? `${CATEGORIES.find(c => c.id === selectedNodeForInfo.category)?.color}20` : '#404040',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: selectedNodeForInfo ? CATEGORIES.find(c => c.id === selectedNodeForInfo.category)?.color : '#9ca3af'
              }}
            >
              <CodeIcon />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: '#f1f5f9' }}>
                {selectedNodeForInfo?.name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                {selectedNodeForInfo?.category} • {selectedNodeForInfo?.subcategory}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ color: '#f1f5f9' }}>
          <Typography variant="body2" sx={{ mb: 2, color: '#d1d5db' }}>
            {selectedNodeForInfo?.description}
          </Typography>
          
          {selectedNodeForInfo?.ports.inputs && selectedNodeForInfo.ports.inputs.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}>
                <InputIcon sx={{ fontSize: 16 }} /> Inputs
              </Typography>
              {selectedNodeForInfo.ports.inputs.map((input, index) => (
                <Chip
                  key={index}
                  label={`${input.name}: ${input.dataType}`}
                  size="small"
                  sx={{ mr: 1, mb: 1, backgroundColor: '#404040', color: '#f1f5f9' }}
                />
              ))}
            </Box>
          )}
          
          {selectedNodeForInfo?.ports.outputs && selectedNodeForInfo.ports.outputs.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}>
                <OutputIcon sx={{ fontSize: 16 }} /> Outputs
              </Typography>
              {selectedNodeForInfo.ports.outputs.map((output, index) => (
                <Chip
                  key={index}
                  label={`${output.name}: ${output.dataType}`}
                  size="small"
                  sx={{ mr: 1, mb: 1, backgroundColor: '#404040', color: '#f1f5f9' }}
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #404040' }}>
          <Button 
            onClick={() => setInfoDialogOpen(false)}
            sx={{ color: '#9ca3af' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
