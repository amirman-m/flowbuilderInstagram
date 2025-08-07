import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';

/**
 * Custom hook for authentication management
 * Handles automatic token refresh and authentication state
 */
export const useAuth = () => {
  const { user, isAuthenticated, initializeAuth } = useAuthStore();

  useEffect(() => {
    // Initialize auth state from localStorage on mount
    initializeAuth();
  }, [initializeAuth]);

  /**
   * Check if user is authenticated
   */
  const checkAuth = (): boolean => {
    return isAuthenticated && !!user;
  };

  /**
   * Manually refresh authentication (optional - automatic refresh handled by interceptor)
   */
  const refreshAuth = async (): Promise<boolean> => {
    try {
      const result = await authAPI.refresh();
      return !!result;
    } catch (error) {
      console.error('Manual auth refresh failed:', error);
      return false;
    }
  };

  /**
   * Logout user
   */
  const logout = async (): Promise<void> => {
    await authAPI.logout();
  };

  return {
    user,
    isAuthenticated,
    checkAuth,
    refreshAuth,
    logout,
  };
};

/**
 * Hook for protecting routes - redirects to login if not authenticated
 */
export const useRequireAuth = () => {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
    }
  }, [isAuthenticated, user]);

  return { isAuthenticated, user };
};
