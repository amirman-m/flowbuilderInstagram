import { create } from 'zustand';
import { devtools } from 'zustand/middleware';


// ============================================================================
// EDITOR UI STATE TYPES
// ============================================================================

/**
 * Viewport state for the flow canvas
 */
export interface ViewportState {
  /** X offset of the viewport */
  x: number;
  /** Y offset of the viewport */
  y: number;
  /** Zoom level (1.0 = 100%) */
  zoom: number;
}

/**
 * Selection state for nodes and connections
 */
export interface SelectionState {
  /** Currently selected node IDs */
  selectedNodes: Set<string>;
  /** Currently selected connection IDs */
  selectedConnections: Set<string>;
  /** Whether multiple selection is active */
  multiSelect: boolean;
}

/**
 * Drag and drop state
 */
export interface DragState {
  /** Whether a drag operation is in progress */
  isDragging: boolean;
  /** Type of item being dragged */
  dragType: 'node' | 'connection' | 'selection' | null;
  /** Data associated with the drag operation */
  dragData: any;
  /** Current drag position */
  dragPosition: { x: number; y: number } | null;
}

/**
 * Panel visibility and layout state
 */
export interface PanelState {
  /** Whether the node palette is visible */
  paletteVisible: boolean;
  /** Whether the node inspector is visible */
  inspectorVisible: boolean;
  /** Whether the execution panel is visible */
  executionPanelVisible: boolean;
  /** Whether the minimap is visible */
  minimapVisible: boolean;
  /** Width of the left sidebar */
  leftSidebarWidth: number;
  /** Width of the right sidebar */
  rightSidebarWidth: number;
}

/**
 * Canvas interaction modes
 */
export enum CanvasMode {
  /** Default mode - select and move nodes */
  SELECT = 'select',
  /** Pan mode - drag to move viewport */
  PAN = 'pan',
  /** Connect mode - create connections between nodes */
  CONNECT = 'connect',
  /** Add mode - click to add nodes */
  ADD = 'add'
}

// ============================================================================
// EDITOR STORE STATE INTERFACE
// ============================================================================

interface EditorStoreState {
  // ========== VIEWPORT AND CANVAS ==========
  /** Current viewport state */
  viewport: ViewportState;
  
  /** Current canvas interaction mode */
  canvasMode: CanvasMode;
  
  /** Whether the canvas is currently being panned */
  isPanning: boolean;
  
  /** Canvas background pattern visibility */
  showGrid: boolean;
  
  /** Snap to grid functionality */
  snapToGrid: boolean;
  
  /** Grid size for snapping */
  gridSize: number;
  
  // ========== SELECTION STATE ==========
  /** Current selection state */
  selection: SelectionState;
  
  /** Node that is currently being hovered */
  hoveredNode: string | null;
  
  /** Connection that is currently being hovered */
  hoveredConnection: string | null;
  
  // ========== DRAG AND DROP ==========
  /** Current drag state */
  dragState: DragState;
  
  /** Whether a new connection is being created */
  connectingFrom: {
    nodeId: string;
    portId: string;
    portType: 'input' | 'output';
  } | null;
  
  // ========== PANEL LAYOUT ==========
  /** Panel visibility and sizing */
  panels: PanelState;
  
  // ========== HISTORY AND UNDO/REDO ==========
  /** Whether undo is available */
  canUndo: boolean;
  
  /** Whether redo is available */
  canRedo: boolean;
  
  // ========== ACTIONS ==========
  
  // --- Viewport Management ---
  /** Set viewport position and zoom */
  setViewport: (viewport: Partial<ViewportState>) => void;
  
  /** Reset viewport to default */
  resetViewport: () => void;
  
  /** Fit all nodes in viewport */
  fitToView: () => void;
  
  /** Center viewport on specific node */
  centerOnNode: (nodeId: string) => void;
  
  // --- Canvas Mode ---
  /** Set canvas interaction mode */
  setCanvasMode: (mode: CanvasMode) => void;
  
  /** Toggle grid visibility */
  toggleGrid: () => void;
  
  /** Toggle snap to grid */
  toggleSnapToGrid: () => void;
  
  /** Set grid size */
  setGridSize: (size: number) => void;
  
  // --- Selection Management ---
  /** Select a single node */
  selectNode: (nodeId: string, multiSelect?: boolean) => void;
  
  /** Select multiple nodes */
  selectNodes: (nodeIds: string[]) => void;
  
  /** Select a connection */
  selectConnection: (connectionId: string, multiSelect?: boolean) => void;
  
  /** Clear all selections */
  clearSelection: () => void;
  
  /** Select all nodes */
  selectAll: () => void;
  
  /** Check if a node is selected */
  isNodeSelected: (nodeId: string) => boolean;
  
  /** Check if a connection is selected */
  isConnectionSelected: (connectionId: string) => boolean;
  
  // --- Hover State ---
  /** Set hovered node */
  setHoveredNode: (nodeId: string | null) => void;
  
  /** Set hovered connection */
  setHoveredConnection: (connectionId: string | null) => void;
  
  // --- Drag and Drop ---
  /** Start drag operation */
  startDrag: (type: DragState['dragType'], data: any, position: { x: number; y: number }) => void;
  
  /** Update drag position */
  updateDragPosition: (position: { x: number; y: number }) => void;
  
  /** End drag operation */
  endDrag: () => void;
  
  /** Start connection creation */
  startConnection: (nodeId: string, portId: string, portType: 'input' | 'output') => void;
  
  /** End connection creation */
  endConnection: () => void;
  
  // --- Panel Management ---
  /** Toggle panel visibility */
  togglePanel: (panel: keyof PanelState) => void;
  
  /** Set panel visibility */
  setPanelVisible: (panel: keyof PanelState, visible: boolean) => void;
  
  /** Resize sidebar */
  resizeSidebar: (side: 'left' | 'right', width: number) => void;
  
  // --- History ---
  /** Perform undo */
  undo: () => void;
  
  /** Perform redo */
  redo: () => void;
  
  // --- Utility ---
  /** Reset editor to initial state */
  resetEditor: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialViewport: ViewportState = {
  x: 0,
  y: 0,
  zoom: 1.0
};

const initialSelection: SelectionState = {
  selectedNodes: new Set(),
  selectedConnections: new Set(),
  multiSelect: false
};

const initialDragState: DragState = {
  isDragging: false,
  dragType: null,
  dragData: null,
  dragPosition: null
};

const initialPanels: PanelState = {
  paletteVisible: true,
  inspectorVisible: true,
  executionPanelVisible: false,
  minimapVisible: true,
  leftSidebarWidth: 300,
  rightSidebarWidth: 350
};

const initialState = {
  viewport: initialViewport,
  canvasMode: CanvasMode.SELECT,
  isPanning: false,
  showGrid: true,
  snapToGrid: false,
  gridSize: 20,
  selection: initialSelection,
  hoveredNode: null,
  hoveredConnection: null,
  dragState: initialDragState,
  connectingFrom: null,
  panels: initialPanels,
  canUndo: false,
  canRedo: false,
};

// ============================================================================
// EDITOR STORE IMPLEMENTATION
// ============================================================================

export const useEditorStore = create<EditorStoreState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========== VIEWPORT MANAGEMENT ==========
      
      /**
       * Set viewport position and zoom
       */
      setViewport: (viewport: Partial<ViewportState>) => {
        set(state => ({
          viewport: { ...state.viewport, ...viewport }
        }));
      },

      /**
       * Reset viewport to default position and zoom
       */
      resetViewport: () => {
        set({ viewport: initialViewport });
      },

      /**
       * Fit all nodes in viewport
       * TODO: Implement based on actual node positions
       */
      fitToView: () => {
        // This would calculate bounds of all nodes and adjust viewport
        // For now, just reset to default
        get().resetViewport();
      },

      /**
       * Center viewport on specific node
       * TODO: Implement based on node position
       */
      centerOnNode: (nodeId: string) => {
        // This would get node position and center viewport on it
        console.log(`Centering on node: ${nodeId}`);
      },

      // ========== CANVAS MODE MANAGEMENT ==========
      
      /**
       * Set canvas interaction mode
       */
      setCanvasMode: (mode: CanvasMode) => {
        set({ canvasMode: mode });
        
        // Clear selection when switching to certain modes
        if (mode === CanvasMode.PAN || mode === CanvasMode.ADD) {
          get().clearSelection();
        }
      },

      /**
       * Toggle grid visibility
       */
      toggleGrid: () => {
        set(state => ({ showGrid: !state.showGrid }));
      },

      /**
       * Toggle snap to grid functionality
       */
      toggleSnapToGrid: () => {
        set(state => ({ snapToGrid: !state.snapToGrid }));
      },

      /**
       * Set grid size for snapping
       */
      setGridSize: (size: number) => {
        set({ gridSize: Math.max(5, Math.min(100, size)) }); // Clamp between 5-100
      },

      // ========== SELECTION MANAGEMENT ==========
      
      /**
       * Select a single node
       */
      selectNode: (nodeId: string, multiSelect = false) => {
        set(state => {
          const newSelectedNodes = new Set(
            multiSelect ? state.selection.selectedNodes : []
          );
          
          if (newSelectedNodes.has(nodeId)) {
            newSelectedNodes.delete(nodeId);
          } else {
            newSelectedNodes.add(nodeId);
          }
          
          return {
            selection: {
              ...state.selection,
              selectedNodes: newSelectedNodes,
              selectedConnections: multiSelect ? state.selection.selectedConnections : new Set(),
              multiSelect
            }
          };
        });
      },

      /**
       * Select multiple nodes
       */
      selectNodes: (nodeIds: string[]) => {
        set(state => ({
          selection: {
            ...state.selection,
            selectedNodes: new Set(nodeIds),
            selectedConnections: new Set(),
            multiSelect: nodeIds.length > 1
          }
        }));
      },

      /**
       * Select a connection
       */
      selectConnection: (connectionId: string, multiSelect = false) => {
        set(state => {
          const newSelectedConnections = new Set(
            multiSelect ? state.selection.selectedConnections : []
          );
          
          if (newSelectedConnections.has(connectionId)) {
            newSelectedConnections.delete(connectionId);
          } else {
            newSelectedConnections.add(connectionId);
          }
          
          return {
            selection: {
              ...state.selection,
              selectedNodes: multiSelect ? state.selection.selectedNodes : new Set(),
              selectedConnections: newSelectedConnections,
              multiSelect
            }
          };
        });
      },

      /**
       * Clear all selections
       */
      clearSelection: () => {
        set(state => ({
          selection: {
            ...state.selection,
            selectedNodes: new Set(),
            selectedConnections: new Set(),
            multiSelect: false
          }
        }));
      },

      /**
       * Select all nodes in the current flow
       * TODO: Get actual node list from flow store
       */
      selectAll: () => {
        // This would get all node IDs from the current flow
        // For now, just clear selection
        get().clearSelection();
      },

      /**
       * Check if a node is selected
       */
      isNodeSelected: (nodeId: string) => {
        const { selection } = get();
        return selection.selectedNodes.has(nodeId);
      },

      /**
       * Check if a connection is selected
       */
      isConnectionSelected: (connectionId: string) => {
        const { selection } = get();
        return selection.selectedConnections.has(connectionId);
      },

      // ========== HOVER STATE MANAGEMENT ==========
      
      /**
       * Set hovered node
       */
      setHoveredNode: (nodeId: string | null) => {
        set({ hoveredNode: nodeId });
      },

      /**
       * Set hovered connection
       */
      setHoveredConnection: (connectionId: string | null) => {
        set({ hoveredConnection: connectionId });
      },

      // ========== DRAG AND DROP MANAGEMENT ==========
      
      /**
       * Start drag operation
       */
      startDrag: (type: DragState['dragType'], data: any, position: { x: number; y: number }) => {
        set({
          dragState: {
            isDragging: true,
            dragType: type,
            dragData: data,
            dragPosition: position
          }
        });
      },

      /**
       * Update drag position
       */
      updateDragPosition: (position: { x: number; y: number }) => {
        set(state => ({
          dragState: {
            ...state.dragState,
            dragPosition: position
          }
        }));
      },

      /**
       * End drag operation
       */
      endDrag: () => {
        set({ dragState: initialDragState });
      },

      /**
       * Start connection creation from a port
       */
      startConnection: (nodeId: string, portId: string, portType: 'input' | 'output') => {
        set({
          connectingFrom: { nodeId, portId, portType },
          canvasMode: CanvasMode.CONNECT
        });
      },

      /**
       * End connection creation
       */
      endConnection: () => {
        set({
          connectingFrom: null,
          canvasMode: CanvasMode.SELECT
        });
      },

      // ========== PANEL MANAGEMENT ==========
      
      /**
       * Toggle panel visibility
       */
      togglePanel: (panel: keyof PanelState) => {
        set(state => ({
          panels: {
            ...state.panels,
            [panel]: typeof state.panels[panel] === 'boolean' 
              ? !state.panels[panel] 
              : state.panels[panel]
          }
        }));
      },

      /**
       * Set panel visibility
       */
      setPanelVisible: (panel: keyof PanelState, visible: boolean) => {
        set(state => ({
          panels: {
            ...state.panels,
            [panel]: typeof state.panels[panel] === 'boolean' 
              ? visible 
              : state.panels[panel]
          }
        }));
      },

      /**
       * Resize sidebar
       */
      resizeSidebar: (side: 'left' | 'right', width: number) => {
        const clampedWidth = Math.max(200, Math.min(600, width)); // Clamp between 200-600px
        
        set(state => ({
          panels: {
            ...state.panels,
            [side === 'left' ? 'leftSidebarWidth' : 'rightSidebarWidth']: clampedWidth
          }
        }));
      },

      // ========== HISTORY MANAGEMENT ==========
      
      /**
       * Perform undo operation
       * TODO: Implement actual undo/redo functionality
       */
      undo: () => {
        console.log('Undo operation - to be implemented');
      },

      /**
       * Perform redo operation
       * TODO: Implement actual undo/redo functionality
       */
      redo: () => {
        console.log('Redo operation - to be implemented');
      },

      // ========== UTILITY ==========
      
      /**
       * Reset editor to initial state
       */
      resetEditor: () => {
        set(initialState);
      }
    }),
    {
      name: 'editor-store', // Name for Redux DevTools
    }
  )
);
