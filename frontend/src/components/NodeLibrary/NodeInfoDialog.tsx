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
import { Code as CodeIcon, Input as InputIcon, Output as OutputIcon } from '@mui/icons-material';
import { NodeType } from '../../types/nodes';
import { CategoryItem } from '../../config/categories';
import styles from './NodeLibrary.module.css';

interface NodeInfoDialogProps {
  open: boolean;
  onClose: () => void;
  node: NodeType | null;
  categories: CategoryItem[];
}

export const NodeInfoDialog: React.FC<NodeInfoDialogProps> = ({ open, onClose, node, categories }) => {
  const categoryColor = node ? (categories.find((c) => c.id === node.category)?.color || '#9ca3af') : '#9ca3af';

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
            <CodeIcon />
          </Box>
          <Box>
            <Typography variant="h6" className={styles.dialogNodeName}>
              {node?.name}
            </Typography>
            <Typography variant="caption" className={styles.dialogNodeCategory}>
              {node?.category}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent className={styles.dialogContent}>
        <Typography variant="body2" className={styles.dialogContentText}>
          {node?.description}
        </Typography>

        {node?.ports.inputs && node.ports.inputs.length > 0 && (
          <Box className={styles.dialogSection}>
            <Typography variant="subtitle2" className={styles.dialogSectionTitle}>
              <InputIcon /> Inputs
            </Typography>
            {node.ports.inputs.map((input, index) => (
              <Chip
                key={index}
                label={`${input.name}: ${input.dataType}`}
                size="small"
                className={styles.dialogChip}
              />
            ))}
          </Box>
        )}

        {node?.ports.outputs && node.ports.outputs.length > 0 && (
          <Box className={styles.dialogSection}>
            <Typography variant="subtitle2" className={styles.dialogSectionTitle}>
              <OutputIcon /> Outputs
            </Typography>
            {node.ports.outputs.map((output, index) => (
              <Chip
                key={index}
                label={`${output.name}: ${output.dataType}`}
                size="small"
                className={styles.dialogChip}
              />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions className={styles.dialogActions}>
        <Button onClick={onClose} className={styles.dialogCloseButton}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
