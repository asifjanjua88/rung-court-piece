'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import api from '@/services/api.service'
import Spinner from '@/components/ui/Spinner'
import Link from 'next/link'

const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
}
const SUIT_COLOR: Record<string, string> = {
  spades: 'text-white', hearts: 'text-red-400',
  diamonds: 'text-red-400', clubs: 'text-white',
}

interface Overview {
  total_games: string
  wins: string
  losses: string
  win_rate_pct: string
  rooms_played: string
  last_played_at: string | null
}

interface RecentGame {
  id: string
  round_number: number
  scenario: 'A' | 'B'
  trump_suit: string
  winning_team: 'A' | 'B'
  my_team: 'A' | 'B'
  won: boolean
  completed_at: string
}

interface StatsData {
  overview: Overview
  recentGames: RecentGame[]
  currentStreak: { result: 'W' | 'L'; cnt: string } | null
  scenarios: Record<string, { total: number; wins: number }>
}

export default function StatsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [stats, setStats]     = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (user.identityType === 'guest') return

    api.get('/stats/my-stats')
      .then(r => setStats(r.data.data))
      .catch(() => setError('Failed to load stats'))
      .finally(() => setLoading(false))
  }, [user, router])

  if (!user) return null

  if (user.identityType === 'guest') {
    return (
      <div className="min-h-screen felt-table flex items-center justify-center p-4">
        <div className="auth-card text-center max-w-sm">
          <div className="text-5xl mb-4">🎭</div>
          <h2 className="text-xl font-bold text-white mb-2">Guest Mode</h2>
          <p className="text-slate-400 text-sm mb-6">
            Stats are only saved for registered players.<br />
            Create a free account to track your wins!
          </p>
          <Link href="/register" className="btn-primary block">Create Account</Link>
          <Link href="/lobby"    className="btn-ghost block mt-3 text-sm">Back to Lobby</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen felt-table flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen felt-table flex items-center justify-center p-4">
        <div className="auth-card text-center">
          <p className="text-red-400 mb-4">{error || 'No stats yet'}</p>
          <Link href="/lobby" className="btn-secondary">Back to Lobby</Link>
        </div>
      </div>
    )
  }

  const { overview, recentGames, currentStreak, scenarios } = stats
  const totalGames = parseInt(overview.total_games || '0')

  return (
    <div className="min-h-screen felt-table py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/lobby" className="text-white/50 hover:text-white/80 text-sm transition-colors">
            ← Lobby
          </Link>
          <h1 className="text-white font-bold text-xl">My Stats</h1>
          <div className="text-white/40 text-sm">{user.displayName}</div>
        </div>

        {/* No games yet */}
        {totalGames === 0 ? (
          <div className="auth-card text-center py-12">
            <div className="text-5xl mb-4">🃏</div>
            <h2 className="text-white font-bold text-lg mb-2">No games played yet</h2>
            <p className="text-slate-400 text-sm mb-6">
              Complete your first game to see stats here.
            </p>
            <Link href="/lobby" className="btn-primary">Find a Game</Link>
          </div>
        ) : (<>

          {/* Overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Games',   value: overview.total_games, icon: '🃏' },
              { label: 'Wins',    value: overview.wins,        icon: '🏆' },
              { label: 'Losses',  value: overview.losses,      icon: '😔' },
              { label: 'Win Rate', value: `${overview.win_rate_pct ?? '0'}%`, icon: '📊' },
            ].map(c => (
              <div key={c.label} className="bg-black/40 backdrop-blur rounded-2xl border border-white/10 p-4 text-center">
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className="text-2xl font-bold text-white">{c.value ?? '0'}</div>
                <div className="text-slate-400 text-xs mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Streak + Scenario breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Current streak */}
            <div className="bg-black/40 backdrop-blur rounded-2xl border border-white/10 p-4">
              <p className="text-slate-400 text-xs mb-3">Current Streak</p>
              {currentStreak ? (
                <div className="flex items-center gap-3">
                  <span className="text-4xl">
                    {currentStreak.result === 'W' ? '🔥' : '❄️'}
                  </span>
                  <div>
                    <p className={`text-2xl font-bold ${currentStreak.result === 'W' ? 'text-gold' : 'text-blue-400'}`}>
                      {currentStreak.cnt} {currentStreak.result === 'W' ? 'Win' : 'Loss'}{parseInt(currentStreak.cnt) > 1 ? 's' : ''}
                    </p>
                    <p className="text-slate-500 text-xs">in a row</p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No streak yet</p>
              )}
            </div>

            {/* Scenario breakdown */}
            <div className="bg-black/40 backdrop-blur rounded-2xl border border-white/10 p-4">
              <p className="text-slate-400 text-xs mb-3">By Scenario</p>
              <div className="space-y-2">
                {(['A', 'B'] as const).map(sc => {
                  const s = scenarios[sc]
                  const pct = s?.total ? Math.round(100 * s.wins / s.total) : 0
                  return (
                    <div key={sc}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300">
                          {sc === 'A' ? '🔒 Hidden Rung' : '🌐 Open Rung'}
                        </span>
                        <span className="text-slate-400">
                          {s ? `${s.wins}/${s.total}` : '—'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gold rounded-full transition-all"
                             style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Recent games */}
          {recentGames.length > 0 && (
            <div className="bg-black/40 backdrop-blur rounded-2xl border border-white/10 p-4">
              <p className="text-slate-400 text-xs mb-4">Recent Games</p>
              <div className="space-y-2">
                {recentGames.map(g => (
                  <div key={g.id} className="flex items-center justify-between
                                              bg-white/5 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{g.won ? '✅' : '❌'}</span>
                      <div>
                        <p className="text-white text-xs font-medium">
                          {g.scenario === 'A' ? 'Hidden Rung' : 'Open Rung'}
                          <span className={`ml-2 ${SUIT_COLOR[g.trump_suit]}`}>
                            {SUIT_SYMBOL[g.trump_suit]}
                          </span>
                        </p>
                        <p className="text-slate-500 text-xs">
                          Round {g.round_number} · Team {g.my_team}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-semibold ${g.won ? 'text-gold' : 'text-slate-500'}`}>
                        {g.won ? 'Won' : 'Lost'}
                      </p>
                      <p className="text-slate-600 text-xs">
                        {new Date(g.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/stats/history"
                    className="btn-ghost block text-center text-xs mt-3">
                View full history →
              </Link>
            </div>
          )}

        </>)}
      </div>
    </div>
  )
}
