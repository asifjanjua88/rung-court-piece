import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types/user.types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: User, accessToken: string, refreshToken?: string) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken)
        if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
        set({ user, accessToken, refreshToken: refreshToken ?? null })
      },

      clearAuth: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, accessToken: null, refreshToken: null })
      },

      isAuthenticated: () => !!get().accessToken,
    }),
    { name: 'band-rang-auth', partialize: s => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }) }
  )
)
