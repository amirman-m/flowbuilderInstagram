import React, { lazy, Suspense } from 'react';
import { CircularProgress, Box } from '@mui/material';
import { getComponentName, NODE_REGISTRY } from '../../config/nodeRegistry';

/**
 * Lazy loading utility for Node Library components
 * Implements code splitting to reduce initial bundle size
 * 
 * @author Node Library Team
 * @version 1.0.0
 * @since 2024-08-14
 */

// Loading fallback component for lazy-loaded components
const ComponentLoader: React.FC = () => (
  <Box 
    display="flex" 
    justifyContent="center" 
    alignItems="center" 
    minHeight="200px"
    sx={{ 
      opacity: 0.7,
      transition: 'opacity 0.3s ease-in-out'
    }}
  >
    <CircularProgress size={24} />
  </Box>
);

// Lazy load node components with code splitting
// These components will be loaded only when needed, reducing initial bundle size

/**
 * Lazy-loaded ChatInputNode component
 * Bundle: chat-input-node.chunk.js
 */
export const LazyChatInputNode = lazy(() => 
  import('../nodes/types/ChatInputNode').then(module => ({
    default: module.ChatInputNode
  }))
);

/**
 * Lazy-loaded DeepSeekChatNode component
 * Bundle: deepseek-chat-node.chunk.js
 */
export const LazyDeepSeekChatNode = lazy(() => 
  import('../nodes/types/DeepSeekChatNode').then(module => ({
    default: module.DeepSeekChatNode
  }))
);

/**
 * Lazy-loaded OpenAIChatNode component
 * Bundle: openai-chat-node.chunk.js
 */
export const LazyOpenAIChatNode = lazy(() => 
  import('../nodes/types/OpenAIChatNode').then(module => ({
    default: module.OpenAIChatNode
  }))
);

/**
 * Lazy-loaded TelegramInputNode component
 * Bundle: telegram-input-node.chunk.js
 */
export const LazyTelegramInputNode = lazy(() => 
  import('../nodes/types/TelegramInputNode').then(module => ({
    default: module.TelegramInputNode
  }))
);

/**
 * Lazy-loaded TelegramMessageActionNode component
 * Bundle: telegram-message-action-node.chunk.js
 */
export const LazyTelegramMessageActionNode = lazy(() => 
  import('../nodes/types/TelegramMessageActionNode').then(module => ({
    default: module.TelegramMessageActionNode
  }))
);

/**
 * Lazy-loaded VoiceInputNode component
 * Bundle: voice-input-node.chunk.js
 */
export const LazyVoiceInputNode = lazy(() => 
  import('../nodes/types/VoiceInputNode').then(module => ({
    default: module.VoiceInputNode
  }))
);

/**
 * Lazy-loaded TranscriptionNode component
 * Bundle: transcription-node.chunk.js
 */
export const LazyTranscriptionNode = lazy(() => 
  import('../nodes/types/TranscriptionNode').then(module => ({
    default: module.TranscriptionNode
  }))
);

// Dynamically create lazy components from NODE_REGISTRY
// This eliminates the need to manually maintain a separate registry
const createLazyComponent = (nodeTypeId: string) => {
  const componentName = getComponentName(nodeTypeId);
  return lazy(() => 
    import(`../nodes/node-types/${componentName}`).then(module => ({
      default: module[componentName]
    }))
  );
};

// Registry mapping node type IDs to lazy-loaded components
// Generated dynamically from NODE_REGISTRY to avoid duplication
export const LAZY_NODE_COMPONENTS = Object.keys(NODE_REGISTRY).reduce((acc, nodeTypeId) => {
  acc[nodeTypeId] = createLazyComponent(nodeTypeId);
  return acc;
}, {} as Record<string, React.LazyExoticComponent<React.ComponentType<any>>>);

export type LazyNodeComponentType = keyof typeof LAZY_NODE_COMPONENTS;

// Define proper props interface for node components
interface NodeComponentProps {
  data: any;
  selected: boolean;
  id: string;
  [key: string]: any;
}

/**
 * Higher-order component that wraps lazy-loaded node components with Suspense
 * Provides loading fallback and error boundary
 * 
 * @param nodeTypeId - The node type identifier
 * @param props - Props to pass to the lazy-loaded component
 * @returns JSX element with Suspense wrapper
 * 
 * @example
 * ```tsx
 * // Usage in FlowBuilder or NodeLibrary
 * const ChatInputComponent = withLazyLoading('chat_input', { 
 *   data: nodeData, 
 *   selected: false, 
 *   id: 'node-1' 
 * });
 * ```
 */
export const withLazyLoading = (
  nodeTypeId: string,
  props: NodeComponentProps
): React.ReactElement => {
  const LazyComponent = LAZY_NODE_COMPONENTS[nodeTypeId as LazyNodeComponentType];
  
  if (!LazyComponent) {
    console.warn(`No lazy component found for node type: ${nodeTypeId}`);
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100px"
        sx={{ color: 'warning.main' }}
      >
        Component not found: {nodeTypeId}
      </Box>
    );
  }

  return (
    <Suspense fallback={<ComponentLoader />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

/**
 * Preload specific node components for better UX
 * Call this function when user hovers over a node or category
 * 
 * @param nodeTypeIds - Array of node type IDs to preload
 * 
 * @example
 * ```tsx
 * // Preload components when user hovers over category
 * const handleCategoryHover = (categoryId: NodeCategory) => {
 *   const nodeTypesInCategory = getNodeTypesByCategory(categoryId);
 *   preloadNodeComponents(nodeTypesInCategory);
 * };
 * ```
 */
export const preloadNodeComponents = (nodeTypeIds: string[]): void => {
  nodeTypeIds.forEach(nodeTypeId => {
    const LazyComponent = LAZY_NODE_COMPONENTS[nodeTypeId as LazyNodeComponentType];
    if (LazyComponent) {
      // Trigger the lazy loading without rendering
      const componentImport = (LazyComponent as any)._payload?._result;
      if (!componentImport) {
        // Component not loaded yet, trigger preload
        import(`../nodes/node-types/${getComponentFileName(nodeTypeId)}`).catch(error => {
          console.warn(`Failed to preload component for ${nodeTypeId}:`, error);
        });
      }
    }
  });
};

/**
 * Helper function to get component file name from node type ID
 * Uses centralized NODE_REGISTRY to avoid duplication
 */
const getComponentFileName = (nodeTypeId: string): string => {
  return getComponentName(nodeTypeId);
};

/**
 * Bundle size analysis utility
 * Returns information about lazy-loaded components for debugging
 */
export const getBundleInfo = () => {
  const componentCount = Object.keys(LAZY_NODE_COMPONENTS).length;
  const loadedComponents = Object.entries(LAZY_NODE_COMPONENTS)
    .filter(([, component]) => (component as any)._payload?._result)
    .map(([nodeTypeId]) => nodeTypeId);
  
  return {
    totalComponents: componentCount,
    loadedComponents: loadedComponents.length,
    loadedComponentIds: loadedComponents,
    unloadedComponents: componentCount - loadedComponents.length,
    loadingProgress: `${loadedComponents.length}/${componentCount} (${Math.round((loadedComponents.length / componentCount) * 100)}%)`
  };
};
