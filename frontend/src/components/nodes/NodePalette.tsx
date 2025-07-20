import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  InputAdornment,
  Divider,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  DragIndicator as DragIcon,
  FlashOn as TriggerIcon,
  Memory as ProcessorIcon,
  Send as ActionIcon
} from '@mui/icons-material';
import { NodeType, NodeCategory } from '../../types/nodes';
import { nodeService } from '../../services/nodeService';

// ============================================================================
// TYPES
// ============================================================================

interface NodePaletteProps {
  onNodeSelect: (nodeType: NodeType) => void;
  onNodeDragStart: (nodeType: NodeType, event: React.DragEvent) => void;
  className?: string;
}

interface GroupedNodeTypes {
  [NodeCategory.TRIGGER]: NodeType[];
  [NodeCategory.PROCESSOR]: NodeType[];
  [NodeCategory.ACTION]: NodeType[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getCategoryIcon = (category: NodeCategory) => {
  switch (category) {
    case NodeCategory.TRIGGER:
      return <TriggerIcon />;
    case NodeCategory.PROCESSOR:
      return <ProcessorIcon />;
    case NodeCategory.ACTION:
      return <ActionIcon />;
    default:
      return <DragIcon />;
  }
};

const getCategoryColor = (category: NodeCategory, theme: any) => {
  switch (category) {
    case NodeCategory.TRIGGER:
      return theme.palette.success.main;
    case NodeCategory.PROCESSOR:
      return theme.palette.primary.main;
    case NodeCategory.ACTION:
      return theme.palette.warning.main;
    default:
      return theme.palette.grey[500];
  }
};

const getCategoryDescription = (category: NodeCategory) => {
  switch (category) {
    case NodeCategory.TRIGGER:
      return 'Start flow execution';
    case NodeCategory.PROCESSOR:
      return 'Process and transform data';
    case NodeCategory.ACTION:
      return 'Perform actions and outputs';
    default:
      return '';
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

const NodePalette: React.FC<NodePaletteProps> = ({
  onNodeSelect,
  onNodeDragStart,
  className
}) => {
  const theme = useTheme();
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<NodeCategory>>(
    new Set([NodeCategory.TRIGGER, NodeCategory.PROCESSOR, NodeCategory.ACTION])
  );

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    loadNodeTypes();
  }, []);

  const loadNodeTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const types = await nodeService.types.getNodeTypes();
      setNodeTypes(types);
    } catch (err) {
      setError('Failed to load node types');
      console.error('Error loading node types:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const filteredAndGroupedNodeTypes = useMemo(() => {
    const filtered = nodeTypes.filter(nodeType => {
      if (!searchQuery) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        nodeType.name.toLowerCase().includes(query) ||
        nodeType.description.toLowerCase().includes(query) ||
        nodeType.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    });

    const grouped: GroupedNodeTypes = {
      [NodeCategory.TRIGGER]: [],
      [NodeCategory.PROCESSOR]: [],
      [NodeCategory.ACTION]: []
    };

    filtered.forEach(nodeType => {
      if (grouped[nodeType.category]) {
        grouped[nodeType.category].push(nodeType);
      }
    });

    return grouped;
  }, [nodeTypes, searchQuery]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCategoryToggle = (category: NodeCategory) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleNodeClick = (nodeType: NodeType) => {
    onNodeSelect(nodeType);
  };

  const handleDragStart = (nodeType: NodeType) => (event: React.DragEvent) => {
    onNodeDragStart(nodeType, event);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderNodeTypeItem = (nodeType: NodeType) => {
    const categoryColor = getCategoryColor(nodeType.category, theme);
    
    return (
      <ListItem key={nodeType.id} disablePadding>
        <Tooltip
          title={
            <Box>
              <Typography variant="subtitle2">{nodeType.name}</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {nodeType.description}
              </Typography>
              {nodeType.tags && nodeType.tags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {nodeType.tags.map(tag => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              )}
            </Box>
          }
          placement="right"
          arrow
        >
          <ListItemButton
            draggable
            onDragStart={handleDragStart(nodeType)}
            onClick={() => handleNodeClick(nodeType)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                transform: 'translateX(4px)',
                transition: 'transform 0.2s ease-in-out'
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: categoryColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}
              >
                <DragIcon fontSize="small" />
              </Box>
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" fontWeight="medium">
                  {nodeType.name}
                </Typography>
              }
              secondary={
                <Typography variant="caption" color="text.secondary" noWrap>
                  {nodeType.description}
                </Typography>
              }
            />
            {nodeType.deprecated && (
              <Chip label="Deprecated" size="small" color="warning" variant="outlined" />
            )}
          </ListItemButton>
        </Tooltip>
      </ListItem>
    );
  };

  const renderCategory = (category: NodeCategory) => {
    const categoryNodeTypes = filteredAndGroupedNodeTypes[category];
    const categoryColor = getCategoryColor(category, theme);
    const isExpanded = expandedCategories.has(category);
    
    if (categoryNodeTypes.length === 0) return null;

    return (
      <Accordion
        key={category}
        expanded={isExpanded}
        onChange={() => handleCategoryToggle(category)}
        sx={{
          '&:before': { display: 'none' },
          boxShadow: 'none',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: '8px !important',
          mb: 1,
          '&.Mui-expanded': {
            margin: '0 0 8px 0'
          }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            backgroundColor: theme.palette.grey[50],
            borderRadius: '8px 8px 0 0',
            minHeight: 48,
            '&.Mui-expanded': {
              minHeight: 48,
              borderRadius: '8px 8px 0 0'
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Box sx={{ color: categoryColor }}>
              {getCategoryIcon(category)}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>
                {category}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {getCategoryDescription(category)}
              </Typography>
            </Box>
            <Chip
              label={categoryNodeTypes.length}
              size="small"
              sx={{
                backgroundColor: categoryColor,
                color: 'white',
                fontWeight: 'bold'
              }}
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 1 }}>
          <List dense>
            {categoryNodeTypes.map(renderNodeTypeItem)}
          </List>
        </AccordionDetails>
      </Accordion>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <Paper className={className} sx={{ p: 2, height: '100%' }}>
        <Typography>Loading node types...</Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper className={className} sx={{ p: 2, height: '100%' }}>
        <Typography color="error">{error}</Typography>
      </Paper>
    );
  }

  return (
    <Paper className={className} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Node Palette
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {Object.values(NodeCategory).map(renderCategory)}
        
        {/* Empty State */}
        {nodeTypes.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No node types available
            </Typography>
          </Box>
        )}
        
        {/* No Search Results */}
        {searchQuery && Object.values(filteredAndGroupedNodeTypes).every(arr => arr.length === 0) && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No nodes found for "{searchQuery}"
            </Typography>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Drag nodes to canvas or click to select
        </Typography>
      </Box>
    </Paper>
  );
};

export default NodePalette;
