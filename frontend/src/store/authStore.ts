import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => void;
  initializeAuth: () => void;
}

// Secure token storage utilities
const TOKEN_KEY = 'access_token';
const USER_KEY = 'user_data';

const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const getStoredUser = (): User | null => {
  try {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
};

const setStoredToken = (token: string | null): void => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Handle storage errors silently
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  
  setUser: (user) => {
    setStoredUser(user);
    set({ user, isAuthenticated: !!user && !!get().accessToken });
  },
  
  setAccessToken: (token) => {
    setStoredToken(token);
    set({ accessToken: token, isAuthenticated: !!get().user && !!token });
  },
  
  setAuth: (user, accessToken) => {
    setStoredUser(user);
    setStoredToken(accessToken);
    set({ user, accessToken, isAuthenticated: true });
  },
  
  logout: () => {
    setStoredUser(null);
    setStoredToken(null);
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
  
  initializeAuth: () => {
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    
    if (storedUser && storedToken) {
      set({ 
        user: storedUser, 
        accessToken: storedToken, 
        isAuthenticated: true 
      });
    }
  },
}));

// Initialize auth state on app start
if (typeof window !== 'undefined') {
  useAuthStore.getState().initializeAuth();
}
