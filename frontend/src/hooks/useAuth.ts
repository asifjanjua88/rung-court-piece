'use client'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/services/api.service'

export function useAuth() {
  const router = useRouter()
  const { user, setAuth, clearAuth, isAuthenticated } = useAuthStore()

  const playAsGuest = async (name: string) => {
    const { data } = await authApi.guest(name)
    setAuth(data.user, data.accessToken)
    router.push('/lobby')
  }

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password })
    setAuth(data.user, data.accessToken, data.refreshToken)
    router.push('/lobby')
  }

  const register = async (email: string, password: string, displayName: string) => {
    await authApi.register({ email, password, displayName })
    // Returns success — user needs to verify email
  }

  const logout = () => {
    clearAuth()
    router.push('/')
  }

  return { user, isAuthenticated, playAsGuest, login, register, logout }
}
