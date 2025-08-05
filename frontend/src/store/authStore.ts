import { create } from 'zustand';

interface User {
  id: number
  email: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string | null
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setAuth: (user: User) => void
  logout: () => void
  checkAuth: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  
  setAuth: (user: User) => {
    set({ user, isAuthenticated: true })
  },
  
  logout: async () => {
    try {
      // Call logout endpoint to clear HttpOnly cookies
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include' // Important: include cookies
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      set({ user: null, isAuthenticated: false })
    }
  },
  
  checkAuth: async () => {
    try {
      // Try to get user info using HttpOnly cookie
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include' // Important: include cookies
      })
      
      if (response.ok) {
        const userData = await response.json()
        set({ user: userData.user, isAuthenticated: true })
        return true
      } else {
        set({ user: null, isAuthenticated: false })
        return false
      }
    } catch (error) {
      console.error('Auth check error:', error)
      set({ user: null, isAuthenticated: false })
      return false
    }
  }
}))
