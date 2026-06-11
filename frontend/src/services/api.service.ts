import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api/v1',
  timeout: 10000,
})

// Attach JWT on every request
api.interceptors.request.use(config => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh-token`,
            { refreshToken: refresh }
          )
          localStorage.setItem('access_token', data.accessToken)
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  guest: () => api.post('/auth/guest'),
  register: (data: { email: string; password: string; displayName: string }) =>
    api.post('/auth/register', data),
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; password: string }) =>
    api.post('/auth/reset-password', data),
  upgradeGuest: (data: { email: string; password: string; displayName: string }) =>
    api.post('/auth/upgrade-guest', data),
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export const roomApi = {
  listPublic:  ()         => api.get('/rooms/public'),
  get:         (id: string) => api.get(`/rooms/${id}`),
  getCode:     (id: string) => api.get(`/rooms/${id}/code`),
  quickPlay:   ()         => api.post('/rooms/quick-play'),
  create: (data: { type: 'public' | 'private'; computerSlots?: { position: number; difficulty: string }[] }) =>
    api.post('/rooms/create', data),
  joinPublic:  (roomId: string) => api.post('/rooms/join/public', { roomId }),
  joinPrivate: (code: string)   => api.post('/rooms/join/private', { code }),
  addComputer: (data: { roomId: string; position: number; difficulty: string }) =>
    api.post('/rooms/add-computer', data),
  delete:      (roomId: string) => api.delete(`/rooms/${roomId}`),
}

export default api
