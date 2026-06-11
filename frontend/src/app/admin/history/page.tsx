'use client'
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL

export default function AdminHistoryPage() {
  const [tab, setTab]         = useState<'history'|'leaderboard'|'shame'>('history')
  const [history, setHistory] = useState<any[]>([])
  const [leaders, setLeaders] = useState<any[]>([])
  const [shame, setShame]     = useState<any[]>([])
  const [page, setPage]       = useState(1)
  const [scenario, setScenario] = useState('')
  const [loading, setLoading] = useState(true)

  const token = () => localStorage.getItem('admin_token')

  useEffect(() => {
    const t = token()
    setLoading(true)

    if (tab === 'history') {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(scenario && { scenario }) })
      fetch(`${API}/admin/history?${params}`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.json()).then(d => { setHistory(d.data || []); setLoading(false) })
    } else if (tab === 'leaderboard') {
      fetch(`${API}/admin/history/leaderboard?limit=20`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.json()).then(d => { setLeaders(d.data || []); setLoading(false) })
    } else {
      fetch(`${API}/admin/history/shame-board?limit=20`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.json()).then(d => { setShame(d.data || []); setLoading(false) })
    }
  }, [tab, page, scenario])

  const tabStyle = (t: string) => ({
    padding: '8px 20px', border: 'none', borderRadius: '8px 8px 0 0',
    cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 700 : 400,
    background: tab === t ? '#fff' : '#e2e8f0', color: tab === t ? '#0f172a' : '#64748b',
  })

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 22 }}>🃏 Game History</h2>

      <div style={{ display: 'flex', gap: 4, marginBottom: 0 }}>
        <button style={tabStyle('history')}     onClick={() => setTab('history')}>History</button>
        <button style={tabStyle('leaderboard')} onClick={() => setTab('leaderboard')}>🏆 Leaderboard</button>
        <button style={tabStyle('shame')}       onClick={() => setTab('shame')}>🐴 Shame Board</button>
      </div>

      <div style={{ background: '#fff', borderRadius: '0 8px 8px 8px', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

        {/* Game History Tab */}
        {tab === 'history' && (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <select value={scenario} onChange={e => { setScenario(e.target.value); setPage(1) }}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
                <option value="">All scenarios</option>
                <option value="A">Scenario A (Hidden Rung)</option>
                <option value="B">Scenario B (Open Rung)</option>
              </select>
            </div>
            {loading ? <p>Loading…</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    {['Round', 'Scenario', 'Trump', 'Winner', 'Room Type', 'Kothi Counter', 'Completed'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((g, i) => (
                    <tr key={g.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px' }}>#{g.round_number}</td>
                      <td style={{ padding: '10px 12px' }}>{g.scenario === 'A' ? '🔒 Hidden' : '🌐 Open'}</td>
                      <td style={{ padding: '10px 12px', textTransform: 'capitalize' }}>{g.trump_suit}</td>
                      <td style={{ padding: '10px 12px' }}>Team {g.winning_team}</td>
                      <td style={{ padding: '10px 12px' }}>{g.room_type}</td>
                      <td style={{ padding: '10px 12px' }}>{g.kothi_counter}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{new Date(g.completed_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: '#64748b' }}>Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={history.length < 20}
                style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, cursor: history.length < 20 ? 'not-allowed' : 'pointer' }}>
                Next →
              </button>
            </div>
          </>
        )}

        {/* Leaderboard Tab */}
        {tab === 'leaderboard' && (
          loading ? <p>Loading…</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {['#', 'Player', 'Total Games', 'Wins', 'Losses', 'Win Rate'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaders.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: i < 3 ? 700 : 400 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{p.display_name}</td>
                    <td style={{ padding: '10px 12px' }}>{p.total_games}</td>
                    <td style={{ padding: '10px 12px', color: '#16a34a', fontWeight: 600 }}>{p.wins}</td>
                    <td style={{ padding: '10px 12px', color: '#dc2626' }}>{p.losses}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                          <div style={{ width: `${p.win_rate_pct}%`, height: '100%', background: '#22c55e', borderRadius: 3 }} />
                        </div>
                        <span>{p.win_rate_pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* Shame Board Tab */}
        {tab === 'shame' && (
          loading ? <p>Loading…</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {['#', 'Player', 'Rooms Played', 'Losses'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shame.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px' }}>{i === 0 ? '🐴' : `#${i + 1}`}</td>
                    <td style={{ padding: '10px 12px' }}>{p.display_name}</td>
                    <td style={{ padding: '10px 12px' }}>{p.rooms_played}</td>
                    <td style={{ padding: '10px 12px', color: '#dc2626', fontWeight: 600 }}>{p.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}
