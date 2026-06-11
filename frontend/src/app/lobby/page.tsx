'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { useRoomStore } from '@/store/room.store'
import { roomApi } from '@/services/api.service'
import { PublicRoomSummary } from '@/types/room.types'
import CreateRoomModal from '@/components/lobby/CreateRoomModal'
import JoinPrivateModal from '@/components/lobby/JoinPrivateModal'
import Spinner from '@/components/ui/Spinner'
import Link from 'next/link'

const STATUS_PILL: Record<string, string> = {
  waiting:    'bg-amber-900/50 text-amber-300 border border-amber-700',
  ready:      'bg-green-900/50 text-green-300 border border-green-700',
  in_progress:'bg-blue-900/50 text-blue-300 border border-blue-700',
}

export default function LobbyPage() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  const { publicRooms, setPublicRooms, setCurrentRoom } = useRoomStore()
  const [loading, setLoading]         = useState(true)
  const [createOpen, setCreateOpen]   = useState(false)
  const [joinPrivOpen, setJoinPrivOpen] = useState(false)
  const [joiningId, setJoiningId]     = useState<string | null>(null)

  const fetchRooms = useCallback(async () => {
    try {
      const { data } = await roomApi.listPublic()
      setPublicRooms(data.rooms)
    } catch {
      // silently retry
    } finally {
      setLoading(false)
    }
  }, [setPublicRooms])

  useEffect(() => {
    if (!user) { router.push('/'); return }
    fetchRooms()
    const interval = setInterval(fetchRooms, 5000)
    return () => clearInterval(interval)
  }, [user, router, fetchRooms])

  const handleJoinPublic = async (roomId: string) => {
    setJoiningId(roomId)
    try {
      const { data } = await roomApi.joinPublic(roomId)
      setCurrentRoom(data.room)
      router.push(`/room/${roomId}`)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not join room.')
    } finally {
      setJoiningId(null)
    }
  }

  const handleLogout = () => { clearAuth(); router.push('/') }

  const handleQuickPlay = async () => {
    try {
      const { data } = await roomApi.quickPlay()
      setCurrentRoom(data.room)
      router.push(`/room/${data.room.id}`)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not start quick play.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎴</span>
            <span className="font-bold text-gold text-lg">Band Rang</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-slate-100 text-sm font-medium">{user?.displayName}</p>
              <p className="text-slate-500 text-xs capitalize">{user?.identityType} account</p>
            </div>
            <Link href="/leaderboard"
                  className="text-slate-400 hover:text-gold text-sm transition-colors hidden sm:block">
              🏆 Leaderboard
            </Link>
            {user?.identityType === 'email' && (
              <Link href="/stats"
                    className="text-slate-400 hover:text-white text-sm transition-colors hidden sm:block">
                📊 My Stats
              </Link>
            )}
            <button onClick={handleLogout}
              className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          {/* Quick Play — primary action */}
          <button onClick={handleQuickPlay}
            className="flex items-center gap-2 px-6 py-2.5 bg-gold hover:bg-gold-light
                       text-slate-900 font-bold rounded-xl transition-all active:scale-95 shadow-lg">
            ⚡ Quick Play
            <span className="text-xs font-normal opacity-70">(vs AI)</span>
          </button>

          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600
                       text-slate-100 font-semibold rounded-xl border border-slate-600
                       transition-all active:scale-95">
            ➕ Create Room
          </button>
          <button onClick={() => setJoinPrivOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600
                       text-slate-100 font-semibold rounded-xl border border-slate-600
                       transition-all active:scale-95">
            🔒 Join Private
          </button>
          <button onClick={fetchRooms}
            className="flex items-center gap-2 px-4 py-2.5 text-slate-400
                       hover:text-slate-200 text-sm transition-colors ml-auto">
            🔄
          </button>
        </div>

        {/* Guest upgrade banner */}
        {user?.identityType === 'guest' && (
          <div className="alert-info flex items-center justify-between mb-6">
            <span>🎁 Save your progress — upgrade to a free account</span>
            <button onClick={() => router.push('/upgrade')}
              className="text-blue-300 underline text-sm ml-4 whitespace-nowrap">
              Upgrade now
            </button>
          </div>
        )}

        {/* Public rooms */}
        <div>
          <h2 className="text-slate-200 font-bold text-lg mb-4 flex items-center gap-2">
            🌐 Public Rooms
            {loading && <Spinner size="sm" />}
          </h2>

          {!loading && publicRooms.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <div className="text-5xl mb-3">🃏</div>
              <p className="text-lg">No open rooms right now</p>
              <p className="text-sm mt-1">Create one and computers will join in 3 seconds!</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicRooms.map(room => (
              <div key={room.id}
                className="bg-slate-800 rounded-xl p-4 border border-slate-700
                           hover:border-slate-600 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-slate-200 font-semibold text-sm">{room.creator_name}'s Room</p>
                    <p className="text-slate-500 text-xs mt-0.5">{room.filled_slots}/4 players</p>
                  </div>
                  <span className={`badge text-xs ${STATUS_PILL[room.status] || 'bg-slate-700 text-slate-400'}`}>
                    {room.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Slot indicators */}
                <div className="flex gap-1.5 mb-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i}
                      className={`flex-1 h-1.5 rounded-full ${
                        i < Number(room.filled_slots || 0) ? 'bg-gold' : 'bg-slate-700'
                      }`} />
                  ))}
                </div>

                <button
                  onClick={() => handleJoinPublic(room.id)}
                  disabled={room.status !== 'waiting' || !!joiningId}
                  className="w-full py-2 text-sm font-semibold rounded-lg transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed
                    bg-slate-700 hover:bg-slate-600 text-slate-200
                    enabled:active:scale-95">
                  {joiningId === room.id
                    ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" /> Joining…</span>
                    : room.status === 'waiting' ? 'Join →' : 'In Progress'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinPrivateModal open={joinPrivOpen} onClose={() => setJoinPrivOpen(false)} />
    </div>
  )
}
