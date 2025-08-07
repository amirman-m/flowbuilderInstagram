import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  initializeAuth: () => void;
}

// User data storage utilities (tokens handled by HttpOnly cookies)
const USER_KEY = 'user_data';

const getStoredUser = (): User | null => {
  try {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
};

const setStoredUser = (user: User | null): void => {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    // Handle storage errors silently
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  
  setUser: (user: User | null) => {
    setStoredUser(user);
    set({ user, isAuthenticated: !!user });
  },
  
  logout: () => {
    setStoredUser(null);
    set({ user: null, isAuthenticated: false });
  },
  
  initializeAuth: () => {
    const storedUser = getStoredUser();
    
    if (storedUser) {
      set({ 
        user: storedUser, 
        isAuthenticated: true 
      });
    }
  },
}));

// Initialize auth state on app start
if (typeof window !== 'undefined') {
  useAuthStore.getState().initializeAuth();
}
