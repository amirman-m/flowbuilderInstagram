import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

/**
 * Configuration options for displaying a snackbar notification.
 * 
 * @interface SnackbarOptions
 * @property {string} message - The text message to display in the snackbar
 * @property {AlertColor} [severity='info'] - The severity level determining the color and icon ('success' | 'info' | 'warning' | 'error')
 * @property {number} [duration=6000] - How long the snackbar should be visible in milliseconds
 */
export interface SnackbarOptions {
  message: string;
  severity?: AlertColor;
  duration?: number;
}

/**
 * Context type for the snackbar functionality.
 * 
 * @interface SnackbarContextType
 * @property {Function} showSnackbar - Function to display a snackbar with the given options
 */
interface SnackbarContextType {
  showSnackbar: (options: SnackbarOptions) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

// Allow triggering snackbar from non-React code (e.g., services)
let externalShowSnackbar: ((options: SnackbarOptions) => void) | null = null;

/**
 * Show a snackbar globally from anywhere (services, utilities, etc.).
 * Requires that the app is wrapped with SnackbarProvider.
 */
export const showAppSnackbar = (options: SnackbarOptions) => {
  if (externalShowSnackbar) {
    externalShowSnackbar(options);
  } else {
    // Fallback: provider not mounted yet
    console.warn('SnackbarProvider not initialized. Message:', options);
  }
};

/**
 * Custom React hook to access snackbar functionality.
 * 
 * This hook provides access to the showSnackbar function from anywhere in the component tree
 * that is wrapped with SnackbarProvider. It includes proper error handling to ensure the hook
 * is used within the correct context.
 * 
 * @hook
 * @example
 * ```tsx
 * import { useSnackbar } from '../components/SnackbarProvider';
 * 
 * function MyComponent() {
 *   const { showSnackbar } = useSnackbar();
 * 
 *   const handleSuccess = () => {
 *     showSnackbar({
 *       message: 'Operation completed successfully!',
 *       severity: 'success',
 *       duration: 4000
 *     });
 *   };
 * 
 *   const handleError = () => {
 *     showSnackbar({
 *       message: 'Something went wrong. Please try again.',
 *       severity: 'error'
 *     });
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handleSuccess}>Success</button>
 *       <button onClick={handleError}>Error</button>
 *     </div>
 *   );
 * }
 * ```
 * 
 * @returns {SnackbarContextType} Object containing the showSnackbar function
 * @throws {Error} When used outside of SnackbarProvider context
 * 
 * @since 1.0.0
 * @author Social Media Flow Builder Team
 */
export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
};

/**
 * Props interface for the SnackbarProvider component.
 * 
 * @interface SnackbarProviderProps
 * @property {React.ReactNode} children - Child components that will have access to snackbar functionality
 */
interface SnackbarProviderProps {
  children: React.ReactNode;
}

/**
 * Global snackbar provider component that manages notification state and display.
 * 
 * This component provides a centralized snackbar system for the entire application.
 * It should be placed high in the component tree (typically in App.tsx) to make
 * snackbar functionality available to all child components.
 * 
 * Features:
 * - Centralized notification management
 * - Consistent styling and positioning
 * - Automatic dismissal with configurable duration
 * - Support for different severity levels (success, info, warning, error)
 * - Manual dismissal via close button
 * - Bottom-right positioning for optimal UX
 * 
 * @component
 * @example
 * ```tsx
 * import { SnackbarProvider } from './components/SnackbarProvider';
 * import { MyApp } from './MyApp';
 * 
 * function App() {
 *   return (
 *     <SnackbarProvider>
 *       <MyApp />
 *     </SnackbarProvider>
 *   );
 * }
 * 
 * // In any child component:
 * function ChildComponent() {
 *   const { showSnackbar } = useSnackbar();
 * 
 *   const handleClick = () => {
 *     showSnackbar({
 *       message: 'Hello from child component!',
 *       severity: 'info'
 *     });
 *   };
 * 
 *   return <button onClick={handleClick}>Show Notification</button>;
 * }
 * ```
 * 
 * @param props - The component props
 * @param props.children - Child components that will have access to snackbar functionality
 * @returns A React functional component that provides snackbar context to its children
 * 
 * @since 1.0.0
 * @author Social Media Flow Builder Team
 */
export const SnackbarProvider: React.FC<SnackbarProviderProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');
  const [duration, setDuration] = useState(6000);

  /**
   * Displays a snackbar notification with the specified options.
   * Memoized with useCallback to prevent unnecessary re-renders.
   * 
   * @function showSnackbar
   * @param {SnackbarOptions} options - Configuration options for the snackbar
   * @param {string} options.message - The message to display
   * @param {AlertColor} [options.severity='info'] - The severity level
   * @param {number} [options.duration=6000] - Display duration in milliseconds
   */
  const showSnackbar = useCallback(({ message, severity = 'info', duration = 6000 }: SnackbarOptions) => {
    setMessage(message);
    setSeverity(severity);
    setDuration(duration);
    setOpen(true);
  }, []);

  // Register global handler while provider is mounted
  useEffect(() => {
    externalShowSnackbar = showSnackbar;
    return () => {
      if (externalShowSnackbar === showSnackbar) externalShowSnackbar = null;
    };
  }, [showSnackbar]);

  /**
   * Handles closing the snackbar when user clicks the close button or it auto-dismisses.
   * Memoized with useCallback to prevent unnecessary re-renders.
   * 
   * @function handleClose
   */
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleClose} severity={severity} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
};

export default SnackbarProvider;