import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Paper,

  Badge,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Info as InfoIcon,
  Category as CategoryIcon,
  Code as CodeIcon,
  PlayArrow as PlayIcon,
  Settings as SettingsIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  Input as InputIcon,
  Output as OutputIcon
} from '@mui/icons-material';
import { NodeType, NodeCategory } from '../types/nodes';
import { nodeService } from '../services/nodeService';
import { NODE_REGISTRY } from '../config/nodeRegistry';
const NodeLibrary: React.FC = () => {
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory | 'all'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Load node types on component mount
  useEffect(() => {
    loadNodeTypes();
  }, []);

  const loadNodeTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const types = await nodeService.types.getNodeTypes();
      // Temporary mapping until backend provides subcategory
      const SUBCATEGORY_MAP: Record<string, string> = {
        // Legacy or mock IDs
        openAIChat: 'Chat Models',
        deepSeekChat: 'Chat Models',
        // Actual backend IDs
        'simple-openai-chat': 'Chat Models',
        'simple-deepseek-chat': 'Chat Models'
      };

      const enhancedTypes = types.map(t => {
        const registryEntry = NODE_REGISTRY[t.id];
        return registryEntry 
          ? { ...t, category: registryEntry.category, subcategory: registryEntry.subcategory }
          : t;
      });
      setNodeTypes(enhancedTypes);
    } catch (err) {
      setError('Failed to load node types. Please try again.');
      console.error('Error loading node types:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get all available tags from node types
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    nodeTypes.forEach(nodeType => {
      nodeType.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [nodeTypes]);

  // Filter node types based on search, category, tags, and deprecated status
  const filteredNodeTypes = useMemo(() => {
    return nodeTypes.filter(nodeType => {
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = nodeType.name.toLowerCase().includes(query);
        const matchesDescription = nodeType.description.toLowerCase().includes(query);
        const matchesTags = nodeType.tags?.some(tag => tag.toLowerCase().includes(query));
        
        if (!matchesName && !matchesDescription && !matchesTags) {
          return false;
        }
      }

      // Filter by category
      if (selectedCategory !== 'all' && nodeType.category !== selectedCategory) {
        return false;
      }

      // Filter by tags
      if (selectedTags.length > 0) {
        const hasSelectedTag = selectedTags.some(tag => 
          nodeType.tags?.includes(tag)
        );
        if (!hasSelectedTag) {
          return false;
        }
      }

      // Filter deprecated
      if (!showDeprecated && nodeType.deprecated) {
        return false;
      }

      return true;
    });
  }, [nodeTypes, searchQuery, selectedCategory, selectedTags, showDeprecated]);

  // Group filtered node types by category and subcategory
  const groupedNodeTypes = useMemo(() => {
    const groups: Record<NodeCategory, Record<string, NodeType[]>> = {
      [NodeCategory.TRIGGER]: {},
      [NodeCategory.PROCESSOR]: {},
      [NodeCategory.ACTION]: {}
    };

    filteredNodeTypes.forEach(nodeType => {
      const { category } = nodeType;
      const sub = nodeType.subcategory || 'General';
      if (!groups[category][sub]) {
        groups[category][sub] = [];
      }
      groups[category][sub].push(nodeType);
    });

    return groups;
  }, [filteredNodeTypes]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedTags([]);
    setShowDeprecated(false);
  };

  const getCategoryIcon = (category: NodeCategory) => {
    switch (category) {
      case NodeCategory.TRIGGER:
        return <PlayIcon />;
      case NodeCategory.PROCESSOR:
        return <CodeIcon />;
      case NodeCategory.ACTION:
        return <SettingsIcon />;
      default:
        return <CategoryIcon />;
    }
  };

  const getCategoryColor = (category: NodeCategory) => {
    switch (category) {
      case NodeCategory.TRIGGER:
        return '#4CAF50'; // Green
      case NodeCategory.PROCESSOR:
        return '#2196F3'; // Blue
      case NodeCategory.ACTION:
        return '#FF9800'; // Orange
      default:
        return '#757575'; // Grey
    }
  };

  const handleDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/json', JSON.stringify({
      type: 'nodeType',
      nodeType: nodeType
    }));
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleNodeDetails = (nodeType: NodeType) => {
    setSelectedNodeType(nodeType);
    setDetailsModalOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsModalOpen(false);
    setSelectedNodeType(null);
  };

  const NodeTypeCard: React.FC<{ nodeType: NodeType }> = ({ nodeType }) => (
    <Card 
      draggable
      onDragStart={(e) => handleDragStart(e, nodeType)}
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        border: `2px solid ${getCategoryColor(nodeType.category)}20`,
        cursor: 'grab',
        '&:hover': {
          border: `2px solid ${getCategoryColor(nodeType.category)}60`,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out'
        },
        '&:active': {
          cursor: 'grabbing'
        }
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box 
            sx={{ 
              color: getCategoryColor(nodeType.category),
              mr: 1,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {getCategoryIcon(nodeType.category)}
          </Box>
          <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
            {nodeType.name}
          </Typography>
          {nodeType.deprecated && (
            <Chip 
              label="Deprecated" 
              size="small" 
              color="warning" 
              variant="outlined"
            />
          )}
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {nodeType.description}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Chip 
            label={nodeType.category}
            size="small"
            sx={{ 
              backgroundColor: `${getCategoryColor(nodeType.category)}20`,
              color: getCategoryColor(nodeType.category),
              mr: 1
            }}
          />
          <Chip 
            label={`v${nodeType.version}`}
            size="small"
            variant="outlined"
          />
        </Box>

        {nodeType.tags && nodeType.tags.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {nodeType.tags.slice(0, 3).map(tag => (
                <Chip 
                  key={tag}
                  label={tag}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: '20px' }}
                />
              ))}
              {nodeType.tags.length > 3 && (
                <Chip 
                  label={`+${nodeType.tags.length - 3}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: '20px' }}
                />
              )}
            </Stack>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Inputs: {nodeType.ports.inputs.length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Outputs: {nodeType.ports.outputs.length}
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Button 
          size="small" 
          startIcon={<AddIcon />}
          variant="contained"
          sx={{ 
            backgroundColor: getCategoryColor(nodeType.category),
            '&:hover': {
              backgroundColor: getCategoryColor(nodeType.category) + 'CC'
            }
          }}
        >
          Add to Flow
        </Button>
        <Tooltip title="View Details">
          <IconButton size="small" onClick={() => handleNodeDetails(nodeType)}>
            <InfoIcon />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );

  const CategorySection: React.FC<{ 
    category: NodeCategory; 
    subcategoryGroups: Record<string, NodeType[]>;
  }> = ({ category, subcategoryGroups }) => {
    const subcategories = Object.entries(subcategoryGroups);
    if (subcategories.length === 0) return null;

    return (
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ color: getCategoryColor(category), mr: 1 }}>
            {getCategoryIcon(category)}
          </Box>
          <Typography variant="h5" sx={{ flexGrow: 1, textTransform: 'capitalize' }}>
            {category} Nodes
          </Typography>
          <Badge badgeContent={subcategories.reduce((acc,[,v])=>acc+v.length,0)} color="primary">
            <Box />
          </Badge>
        </Box>
        
        {subcategories.map(([subName, types]) => (
          <Accordion key={subName} defaultExpanded sx={{ mb:2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                <Chip label={subName} size="small" />
                <Typography variant="subtitle1">{types.length} nodes</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {types.map(nt => (
                  <Grid item xs={12} sm={6} md={4} key={nt.id}>
                    <NodeTypeCard nodeType={nt} />
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Loading node library...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={loadNodeTypes}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Node Library
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Browse and discover available node types for your automation flows
        </Typography>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Filters</Typography>
          <Box sx={{ flexGrow: 1 }} />
          {(searchQuery || selectedCategory !== 'all' || selectedTags.length > 0 || showDeprecated) && (
            <Button 
              startIcon={<ClearIcon />} 
              onClick={clearFilters}
              size="small"
            >
              Clear All
            </Button>
          )}
        </Box>

        <Grid container spacing={2}>
          {/* Search */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search nodes by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {/* Category Filter */}
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                label="Category"
                onChange={(e) => setSelectedCategory(e.target.value as NodeCategory | 'all')}
              >
                <MenuItem value="all">All Categories</MenuItem>
                <MenuItem value={NodeCategory.TRIGGER}>Trigger</MenuItem>
                <MenuItem value={NodeCategory.PROCESSOR}>Processor</MenuItem>
                <MenuItem value={NodeCategory.ACTION}>Action</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Show Deprecated */}
          <Grid item xs={12} md={3}>
            <Button
              variant={showDeprecated ? "contained" : "outlined"}
              onClick={() => setShowDeprecated(!showDeprecated)}
              fullWidth
              sx={{ height: '56px' }}
            >
              {showDeprecated ? 'Hide' : 'Show'} Deprecated
            </Button>
          </Grid>
        </Grid>

        {/* Tags Filter */}
        {availableTags.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Filter by Tags:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {availableTags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  clickable
                  color={selectedTags.includes(tag) ? "primary" : "default"}
                  onClick={() => handleTagToggle(tag)}
                  size="small"
                />
              ))}
            </Stack>
          </Box>
        )}
      </Paper>

      {/* Results Summary */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Showing {filteredNodeTypes.length} of {nodeTypes.length} node types
        </Typography>
      </Box>

      {/* Node Types by Category */}
      {filteredNodeTypes.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No nodes found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search criteria or filters
          </Typography>
        </Paper>
      ) : (
        <>
          <CategorySection 
            category={NodeCategory.TRIGGER} 
            subcategoryGroups={groupedNodeTypes[NodeCategory.TRIGGER]}
          />
          <CategorySection 
            category={NodeCategory.PROCESSOR} 
            subcategoryGroups={groupedNodeTypes[NodeCategory.PROCESSOR]}
          />
          <CategorySection 
            category={NodeCategory.ACTION} 
            subcategoryGroups={groupedNodeTypes[NodeCategory.ACTION]}
          />
        </>
      )}

      {/* Node Details Modal */}
      <Dialog 
        open={detailsModalOpen} 
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {selectedNodeType && (
            <>
              <Box sx={{ color: getCategoryColor(selectedNodeType.category) }}>
                {getCategoryIcon(selectedNodeType.category)}
              </Box>
              <Box>
                <Typography variant="h6">{selectedNodeType.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedNodeType.category} • v{selectedNodeType.version}
                </Typography>
              </Box>
            </>
          )}
        </DialogTitle>
        
        <DialogContent>
          {selectedNodeType && (
            <Box>
              {/* Description */}
              <Typography variant="body1" paragraph>
                {selectedNodeType.description}
              </Typography>

              {/* Tags */}
              {selectedNodeType.tags && selectedNodeType.tags.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>Tags</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {selectedNodeType.tags.map(tag => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Input Ports */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InputIcon color="primary" />
                    <Typography variant="h6">
                      Input Ports ({selectedNodeType.ports.inputs.length})
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {selectedNodeType.ports.inputs.length === 0 ? (
                    <Typography color="text.secondary">No input ports</Typography>
                  ) : (
                    <List dense>
                      {selectedNodeType.ports.inputs.map(port => (
                        <ListItem key={port.id}>
                          <ListItemIcon>
                            <Chip 
                              label={port.dataType} 
                              size="small" 
                              color={port.required ? "primary" : "default"}
                              variant="outlined"
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={`${port.label} ${port.required ? '*' : ''}`}
                            secondary={port.description || `Internal name: ${port.name}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Output Ports */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <OutputIcon color="secondary" />
                    <Typography variant="h6">
                      Output Ports ({selectedNodeType.ports.outputs.length})
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {selectedNodeType.ports.outputs.length === 0 ? (
                    <Typography color="text.secondary">No output ports</Typography>
                  ) : (
                    <List dense>
                      {selectedNodeType.ports.outputs.map(port => (
                        <ListItem key={port.id}>
                          <ListItemIcon>
                            <Chip 
                              label={port.dataType} 
                              size="small" 
                              color="secondary"
                              variant="outlined"
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={port.label}
                            secondary={port.description || `Internal name: ${port.name}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Settings Schema Info */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SettingsIcon />
                    <Typography variant="h6">Configuration Schema</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    This node accepts the following configuration parameters:
                  </Typography>
                  <Box 
                    component="pre" 
                    sx={{ 
                      backgroundColor: '#f5f5f5', 
                      p: 2, 
                      borderRadius: 1, 
                      overflow: 'auto',
                      fontSize: '0.8rem'
                    }}
                  >
                    {JSON.stringify(selectedNodeType.settingsSchema, null, 2)}
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* Documentation */}
              {selectedNodeType.documentation && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h6" gutterBottom>Documentation</Typography>
                  <Typography variant="body2">
                    {selectedNodeType.documentation}
                  </Typography>
                </Box>
              )}

              {/* Deprecated Warning */}
              {selectedNodeType.deprecated && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Deprecated:</strong> This node type is deprecated and may be removed in future versions.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDetails}>Close</Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            sx={{ 
              backgroundColor: selectedNodeType ? getCategoryColor(selectedNodeType.category) : undefined,
              '&:hover': {
                backgroundColor: selectedNodeType ? getCategoryColor(selectedNodeType.category) + 'CC' : undefined
              }
            }}
          >
            Add to Flow
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default NodeLibrary;
