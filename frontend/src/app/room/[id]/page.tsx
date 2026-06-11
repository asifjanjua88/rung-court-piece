'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { connectSocket } from '@/services/socket.service'
import { roomApi } from '@/services/api.service'

const BOT_NAMES: Record<number, string> = { 1: 'Faisal', 2: 'John', 3: 'Qasim' }

interface Slot {
  position:     number
  slotType:     'human' | 'computer'
  displayName?: string | null
  playerId?:    string | null
}

const POSITION_LABELS = ['South (You)', 'West', 'North', 'East']
const TEAM_LABEL = (pos: number) => (pos === 0 || pos === 2) ? 'Team A 🔵' : 'Team B 🔴'
const TEAM_COLOR = (pos: number) =>
  (pos === 0 || pos === 2)
    ? 'border-blue-500/50 bg-blue-950/30'
    : 'border-red-500/50 bg-red-950/30'

function getDisplayName(slot: Slot): string {
  if (slot.slotType === 'computer') return slot.displayName || BOT_NAMES[slot.position] || `Bot-${slot.position}`
  return slot.displayName || 'Player'
}

export default function RoomWaitingPage() {
  const { id: roomId } = useParams<{ id: string }>()
  const router   = useRouter()
  const { user } = useAuthStore()

  const [slots, setSlots]           = useState<Slot[]>([])
  const [status, setStatus]         = useState<string>('waiting')
  const [accessCode, setAccessCode] = useState<string | null>(null)
  const [countdown, setCountdown]   = useState<number | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [error, setError]           = useState('')

  // Guards
  const countdownStartedRef = useRef(false)   // prevent countdown re-start
  const navigatingRef       = useRef(false)   // prevent double navigation
  const intervalRef         = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Navigate to game table ────────────────────────────────────────────────
  const goToGame = useCallback(() => {
    if (navigatingRef.current) return
    navigatingRef.current = true
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    router.push(`/game/${roomId}`)
  }, [router, roomId])

  // ─── 5-second countdown; navigates when it hits 0 ─────────────────────────
  const startCountdown = useCallback((seconds: number) => {
    if (countdownStartedRef.current) return      // run only once
    countdownStartedRef.current = true

    if (intervalRef.current) clearInterval(intervalRef.current)
    setCountdown(seconds)

    let remaining = seconds
    intervalRef.current = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        setCountdown(0)
        goToGame()          // ← navigate regardless of socket events
      } else {
        setCountdown(remaining)
      }
    }, 1000)
  }, [goToGame])

  // ─── Fetch room data from API ──────────────────────────────────────────────
  const fetchRoomData = useCallback(async () => {
    try {
      const { data } = await roomApi.get(roomId)
      const room = data.room
      setSlots(room.slots ?? [])
      setStatus(room.status)

      // Grab access code (creator only — 403 for non-creators is fine)
      roomApi.getCode(roomId)
        .then(r => { if (r.data?.accessCode) setAccessCode(r.data.accessCode) })
        .catch(() => {})

      // If room is already ready when we load, start countdown immediately
      if (room.status === 'ready') startCountdown(5)
    } catch {
      setError('Could not load room data.')
    }
  }, [roomId, startCountdown])

  // ─── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !roomId) return

    fetchRoomData()

    const socket = connectSocket()
    socket.emit('join_room', { roomId })

    socket.on('room_joined', () => {/* position logged but not needed */})

    // Another player joined — refresh slots
    socket.on('player_connected', () => fetchRoomData())
    socket.on('room_autofilled',  () => fetchRoomData())

    // Game engine signals room is ready (all 4 slots filled)
    socket.on('room_ready', ({ countdown: cd }: { countdown?: number }) => {
      setStatus('ready')
      fetchRoomData()
      startCountdown(cd ?? 5)
    })

    // Game started — navigate immediately (early exit before countdown finishes)
    socket.on('game_state', () => goToGame())

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      socket.off('room_joined')
      socket.off('player_connected')
      socket.off('room_autofilled')
      socket.off('room_ready')
      socket.off('game_state')
    }
  }, [user, roomId, fetchRoomData, startCountdown, goToGame])

  const copyCode = () => {
    if (!accessCode) return
    navigator.clipboard.writeText(accessCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const filledCount = slots.filter(s => s.slotType === 'computer' || s.playerId).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-4">
      <div className="max-w-lg mx-auto pt-12">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎴</div>
          <h1 className="text-2xl font-bold text-slate-100">
            {status === 'ready' ? 'Get Ready!' : 'Waiting for Players'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">{filledCount}/4 players ready</p>

          {/* Countdown pill */}
          {countdown !== null && countdown > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-gold/10 border border-gold/30
                            px-5 py-2 rounded-full animate-pulse">
              <span className="text-gold font-bold text-2xl">{countdown}</span>
              <span className="text-gold text-sm">seconds until game starts</span>
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

        {/* Access code (creator only) */}
        {accessCode && (
          <div className="bg-slate-800 rounded-2xl border border-gold/30 p-5 mb-6 text-center">
            <p className="text-slate-400 text-xs mb-2">Share this code with friends</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-bold tracking-widest text-gold font-game">
                {accessCode}
              </span>
              <button onClick={copyCode} className="text-slate-400 hover:text-gold transition-colors text-sm">
                {codeCopied ? '✅' : '📋'}
              </button>
            </div>
          </div>
        )}

        {/* Player slots */}
        <div className="space-y-3 mb-8">
          {[0, 1, 2, 3].map(pos => {
            const slot   = slots.find(s => s.position === pos)
            const filled = !!slot && (slot.slotType === 'computer' || !!slot.playerId)
            const isMe   = filled && slot?.slotType === 'human' && slot?.playerId === user?.id

            return (
              <div key={pos}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all
                  ${filled ? TEAM_COLOR(pos) : 'border-slate-700 bg-slate-800/50'}`}>

                <div className="text-2xl">
                  {!filled ? '⬜' : slot?.slotType === 'computer' ? '🤖' : '👤'}
                </div>

                <div className="flex-1">
                  <p className="text-slate-200 font-semibold text-sm flex items-center gap-2">
                    {!filled
                      ? <span className="text-slate-500 animate-pulse">Waiting…</span>
                      : getDisplayName(slot!)}
                    {isMe && <span className="text-gold text-xs">(You)</span>}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {POSITION_LABELS[pos]} · {TEAM_LABEL(pos)}
                  </p>
                </div>

                {filled && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    slot?.slotType === 'computer'
                      ? 'bg-purple-900/50 text-purple-300 border-purple-700'
                      : 'bg-green-900/50 text-green-300 border-green-700'
                  }`}>
                    {slot?.slotType === 'computer' ? '🤖 AI' : '✅ Ready'}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Status messages */}
        {status === 'waiting' && (
          <div className="bg-blue-950/50 border border-blue-700 rounded-xl p-4 text-center mb-6 text-sm text-blue-300">
            🕐 Waiting for players… empty slots will auto-fill with AI in a few seconds.
          </div>
        )}

        {status === 'ready' && countdown !== null && countdown > 0 && (
          <div className="bg-green-950/50 border border-green-700 rounded-xl p-4 text-center mb-6">
            <p className="text-green-300 font-semibold">All players ready!</p>
            <p className="text-green-400 text-sm mt-1">
              Game starts automatically in {countdown}s…
            </p>
          </div>
        )}

        <button onClick={() => router.push('/lobby')}
          className="w-full text-center text-slate-500 hover:text-slate-300 text-sm transition-colors mt-2">
          ← Back to Lobby
        </button>
      </div>
    </div>
  )
}
