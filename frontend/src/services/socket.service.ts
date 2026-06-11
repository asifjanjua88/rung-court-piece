import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('access_token')
    console.log('[Socket] Creating socket — token present:', !!token)
    // Extract just the origin so socket.io doesn't misinterpret the path as a namespace.
    // NEXT_PUBLIC_WS_URL must be the origin only (e.g. "http://localhost").
    // The path: '/ws' option below sets the socket.io transport path.
    const rawUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost'
    const wsOrigin = (() => { try { return new URL(rawUrl).origin } catch { return rawUrl } })()
    socket = io(wsOrigin, {
      path: '/ws',
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
    })
    socket.on('connect',        ()    => console.log('[Socket] Connected:', socket!.id))
    socket.on('connect_error',  (err) => console.error('[Socket] connect_error:', err.message))
    socket.on('disconnect',     (reason) => console.log('[Socket] Disconnected:', reason))
  }
  return socket
}

export function connectSocket(): Socket {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect()
    socket = null
  }
}
