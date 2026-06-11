'use client'
import { useEffect, useState, useCallback } from 'react'
import api from '@/services/api.service'
import Spinner from '@/components/ui/Spinner'
import Link from 'next/link'

interface LeaderRow {
  id: string
  display_name: string
  total_games: string
  wins: string
  losses: string
  win_rate_pct: string
  last_played_at: string
}

interface Meta { total: number; page: number; pages: number }

const MEDAL = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const [rows, setRows]       = useState<LeaderRow[]>([])
  const [meta, setMeta]       = useState<Meta | null>(null)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = useCallback((p: number) => {
    setLoading(true)
    api.get(`/stats/leaderboard?page=${p}&limit=20`)
      .then(r => { setRows(r.data.data); setMeta(r.data.meta) })
      .catch(() => setError('Failed to load leaderboard'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(page) }, [page, load])

  return (
    <div className="min-h-screen felt-table py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/lobby" className="text-white/50 hover:text-white/80 text-sm transition-colors">
            ← Lobby
          </Link>
          <h1 className="text-white font-bold text-2xl">🏆 Leaderboard</h1>
          <div className="text-white/40 text-sm">
            {meta ? `${meta.total} players` : ''}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : error ? (
          <div className="auth-card text-center"><p className="text-red-400">{error}</p></div>
        ) : rows.length === 0 ? (
          <div className="auth-card text-center py-12">
            <div className="text-4xl mb-3">🃏</div>
            <p className="text-slate-400">No players yet — be the first!</p>
            <Link href="/lobby" className="btn-primary mt-4 inline-block">Play Now</Link>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem_4rem] gap-2
                            px-4 text-slate-500 text-xs">
              <span>#</span>
              <span>Player</span>
              <span className="text-center">Games</span>
              <span className="text-center">Wins</span>
              <span className="text-center">Loss</span>
              <span className="text-center">Win %</span>
            </div>

            <div className="space-y-1.5">
              {rows.map((r, idx) => {
                const rank = (page - 1) * 20 + idx + 1
                return (
                  <div key={r.id}
                       className={`grid grid-cols-[2rem_1fr_3rem_3rem_3rem_4rem] gap-2 items-center
                                   px-4 py-3 rounded-xl border transition-all
                                   ${rank <= 3
                                     ? 'bg-gold/10 border-gold/30'
                                     : 'bg-black/40 border-white/10 hover:border-white/20'}`}>
                    <span className="text-center font-bold text-sm">
                      {rank <= 3 ? MEDAL[rank - 1] : (
                        <span className="text-slate-500">{rank}</span>
                      )}
                    </span>
                    <span className={`font-semibold text-sm truncate
                                      ${rank <= 3 ? 'text-gold' : 'text-white'}`}>
                      {r.display_name}
                    </span>
                    <span className="text-slate-400 text-sm text-center">{r.total_games}</span>
                    <span className="text-green-400 text-sm text-center font-medium">{r.wins}</span>
                    <span className="text-slate-500 text-sm text-center">{r.losses}</span>
                    <span className={`text-sm text-center font-bold
                                      ${parseFloat(r.win_rate_pct) >= 60
                                        ? 'text-gold'
                                        : parseFloat(r.win_rate_pct) >= 40
                                          ? 'text-white'
                                          : 'text-slate-400'}`}>
                      {r.win_rate_pct}%
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {meta && meta.pages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                        className="btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed">
                  ← Prev
                </button>
                <span className="text-slate-400 text-sm">{page} / {meta.pages}</span>
                <button disabled={page >= meta.pages}
                        onClick={() => setPage(p => p + 1)}
                        className="btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed">
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
