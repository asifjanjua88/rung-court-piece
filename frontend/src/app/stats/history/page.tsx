'use client'
import { useEffect, useState, useCallback } from 'react'
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

interface HistoryRow {
  id: string
  round_number: number
  scenario: 'A' | 'B'
  trump_suit: string
  winning_team: 'A' | 'B'
  my_team: 'A' | 'B'
  won: boolean
  room_type: 'public' | 'private'
  kothi_counter: number
  completed_at: string
}

interface Meta { total: number; page: number; limit: number; pages: number }

export default function HistoryPage() {
  const router = useRouter()
  const { user }  = useAuthStore()
  const [rows, setRows]       = useState<HistoryRow[]>([])
  const [meta, setMeta]       = useState<Meta | null>(null)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = useCallback((p: number) => {
    setLoading(true)
    api.get(`/stats/history?page=${p}&limit=20`)
      .then(r => { setRows(r.data.data); setMeta(r.data.meta) })
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    load(page)
  }, [user, page, load, router])

  return (
    <div className="min-h-screen felt-table py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/stats" className="text-white/50 hover:text-white/80 text-sm transition-colors">
            ← My Stats
          </Link>
          <h1 className="text-white font-bold text-xl">Match History</h1>
          <div className="text-white/40 text-sm">
            {meta ? `${meta.total} games` : ''}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : error ? (
          <div className="auth-card text-center"><p className="text-red-400">{error}</p></div>
        ) : rows.length === 0 ? (
          <div className="auth-card text-center py-12">
            <div className="text-4xl mb-3">🃏</div>
            <p className="text-slate-400">No games yet</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {rows.map((g, idx) => (
                <div key={g.id}
                     className="bg-black/40 backdrop-blur rounded-xl border border-white/10
                                flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-white/30 text-xs w-5 text-right">
                      {(page - 1) * 20 + idx + 1}
                    </span>
                    <span className="text-xl">{g.won ? '✅' : '❌'}</span>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {g.scenario === 'A' ? 'Hidden Rung' : 'Open Rung'}
                        {g.trump_suit && (
                          <span className={`ml-2 ${SUIT_COLOR[g.trump_suit]}`}>
                            {SUIT_SYMBOL[g.trump_suit]}
                          </span>
                        )}
                      </p>
                      <p className="text-slate-500 text-xs">
                        Team {g.my_team} · {g.room_type} · Round {g.round_number}
                        {g.kothi_counter !== 0 && (
                          <span className="ml-1 text-amber-500">
                            🐴 {g.kothi_counter > 0 ? `+${g.kothi_counter}` : g.kothi_counter}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${g.won ? 'text-gold' : 'text-slate-500'}`}>
                      {g.won ? 'Won' : 'Lost'}
                    </p>
                    <p className="text-slate-600 text-xs">
                      {new Date(g.completed_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {meta && meta.pages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                        className="btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed">
                  ← Prev
                </button>
                <span className="text-slate-400 text-sm">
                  {page} / {meta.pages}
                </span>
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
