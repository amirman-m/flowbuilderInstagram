import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import { Input as InputIcon, Output as OutputIcon } from '@mui/icons-material';
import { NodeType } from '../../types/nodes';
import { CategoryItem } from '../../config/categories';
import { renderNodeIcon } from '../../config/nodeIcons';
import styles from './NodeInfoDialog.module.css';

/**
 * Props interface for NodeInfoDialog component with comprehensive validation
 */
interface NodeInfoDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback function when dialog is closed. Must be provided. */
  onClose: () => void;
  /** Node data to display, null if no node selected */
  node: NodeType | null;
  /** Array of category items for color mapping. Must not be null/undefined. */
  categories: CategoryItem[];
}

/**
 * Renders a modal dialog displaying detailed information about a selected node.
 * 
 * This component shows comprehensive node details including name, category, description,
 * input ports, and output ports in a user-friendly dialog format. It's used to provide
 * developers with detailed information about node capabilities and data flow requirements.
 * 
 * @component
 * @example
 * ```tsx
 * import { NodeInfoDialog } from './NodeInfoDialog';
 * import { NodeType } from '../../types/nodes';
 * 
 * function MyComponent() {
 *   const [dialogOpen, setDialogOpen] = useState(false);
 *   const [selectedNode, setSelectedNode] = useState<NodeType | null>(null);
 *   
 *   const handleNodeInfoClick = (node: NodeType) => {
 *     setSelectedNode(node);
 *     setDialogOpen(true);
 *   };
 *   
 *   const handleDialogClose = () => {
 *     setDialogOpen(false);
 *     setSelectedNode(null);
 *   };
 *   
 *   return (
 *     <>
 *       <button onClick={() => handleNodeInfoClick(myNode)}>Show Node Info</button>
 *       <NodeInfoDialog
 *         open={dialogOpen}
 *         onClose={handleDialogClose}
 *         node={selectedNode}
 *         categories={categories}
 *       />
 *     </>
 *   );
 * }
 * ```
 * 
 * @param props - The component props
 * @param props.open - Whether the dialog is currently open and visible
 * @param props.onClose - Callback function invoked when the dialog should be closed
 * @param props.node - The NodeType object to display information for, or null if none selected
 * @param props.categories - Array of category items used for color theming and category name resolution
 * @returns A React functional component that renders the node information modal dialog
 * 
 * @since 1.0.0
 * @author Social Media Flow Builder Team
 */
export const NodeInfoDialog: React.FC<NodeInfoDialogProps> = ({ 
  open = false,
  onClose = () => {
    console.warn('NodeInfoDialog: onClose callback not provided');
  },
  node = null,
  categories = [],
}) => {
  // Validate props
  if (typeof open !== 'boolean') {
    console.error('NodeInfoDialog: open prop must be a boolean');
    return null;
  }

  if (typeof onClose !== 'function') {
    console.error('NodeInfoDialog: onClose must be a function');
    return null;
  }

  if (!Array.isArray(categories)) {
    console.error('NodeInfoDialog: categories prop must be an array');
    return null;
  }

  // Validate node structure if provided
  if (node !== null && (!node || typeof node !== 'object')) {
    console.error('NodeInfoDialog: node must be a valid NodeType object or null');
    return null;
  }

  if (node && (!node.id || !node.name)) {
    console.warn('NodeInfoDialog: node missing required fields (id, name):', node);
  }
  const categoryColor = React.useMemo(() => {
    try {
      if (!node || !node.category) return '#9ca3af';
      const category = categories.find((c) => c && c.id === node.category);
      return category?.color || '#9ca3af';
    } catch (error) {
      console.warn('NodeInfoDialog: Error getting category color:', error);
      return '#9ca3af';
    }
  }, [node, categories]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ className: styles.dialogPaper }}
    >
      <DialogTitle className={styles.dialogTitle}>
        <Box className={styles.dialogTitleContent}>
          <Box
            className={styles.dialogIconWrapper}
            style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
          >
            {node && (() => {
              try {
                return renderNodeIcon(node.id, { style: { color: categoryColor } });
              } catch (error) {
                console.warn('NodeInfoDialog: Error rendering node icon:', error);
                return null;
              }
            })()}
          </Box>
          <Box>
            <Typography variant="h6" className={styles.dialogNodeName}>
              {node?.name || 'Unknown Node'}
            </Typography>
            <Typography variant="caption" className={styles.dialogNodeCategory}>
              {node?.category || 'Unknown Category'}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent className={styles.dialogContent}>
        <Typography variant="body2" className={styles.dialogContentText}>
          {node?.description || 'No description available for this node.'}
        </Typography>

        {node?.ports?.inputs && Array.isArray(node.ports.inputs) && node.ports.inputs.length > 0 && (
          <Box className={styles.dialogSection}>
            <Typography variant="subtitle2" className={styles.dialogSectionTitle}>
              <InputIcon /> Inputs
            </Typography>
            {node.ports.inputs.map((input, index) => {
              // Validate input structure
              if (!input || typeof input !== 'object') {
                console.warn('NodeInfoDialog: Invalid input object at index:', index);
                return null;
              }
              
              const inputName = input.name || `Input ${index + 1}`;
              const inputType = input.dataType || 'unknown';
              
              return (
                <Chip
                  key={`input-${index}-${inputName}`}
                  label={`${inputName}: ${inputType}`}
                  size="small"
                  className={styles.dialogChip}
                />
              );
            })}
          </Box>
        )}

        {node?.ports?.outputs && Array.isArray(node.ports.outputs) && node.ports.outputs.length > 0 && (
          <Box className={styles.dialogSection}>
            <Typography variant="subtitle2" className={styles.dialogSectionTitle}>
              <OutputIcon /> Outputs
            </Typography>
            {node.ports.outputs.map((output, index) => {
              // Validate output structure
              if (!output || typeof output !== 'object') {
                console.warn('NodeInfoDialog: Invalid output object at index:', index);
                return null;
              }
              
              const outputName = output.name || `Output ${index + 1}`;
              const outputType = output.dataType || 'unknown';
              
              return (
                <Chip
                  key={`output-${index}-${outputName}`}
                  label={`${outputName}: ${outputType}`}
                  size="small"
                  className={styles.dialogChip}
                />
              );
            })}
          </Box>
        )}

        {!node && (
          <Box className={styles.dialogSection}>
            <Typography variant="body2" color="text.secondary">
              No node selected for display.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions className={styles.dialogActions}>
        <Button 
          onClick={() => {
            try {
              onClose();
            } catch (error) {
              console.error('NodeInfoDialog: Error in onClose callback:', error);
            }
          }} 
          className={styles.dialogCloseButton}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
