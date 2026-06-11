'use client'
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '20px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      borderTop: `4px solid ${color || '#38bdf8'}`,
    }}>
      <p style={{ margin: '0 0 6px', fontSize: 13, color: '#64748b' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#0f172a' }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats]   = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    fetch(`${API}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading…</p>
  if (!stats)  return <p style={{ color: '#dc2626' }}>Failed to load stats.</p>

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', fontSize: 22 }}>📊 Dashboard</h2>

      <h3 style={{ margin: '0 0 14px', color: '#475569', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
        Users
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Registered"     value={stats.users.total}       color="#6366f1" />
        <StatCard label="New Today"            value={stats.users.newToday}    color="#22c55e" />
        <StatCard label="New This Week"        value={stats.users.newThisWeek} color="#22c55e" />
        <StatCard label="Active Guests"        value={stats.users.guestActive} color="#f59e0b" />
      </div>

      <h3 style={{ margin: '0 0 14px', color: '#475569', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
        Game Activity
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Players Active Today"   value={stats.activity.activePlayersToday}    color="#0ea5e9" />
        <StatCard label="Games Played Today"     value={stats.activity.gamesPlayedToday}      color="#0ea5e9" />
        <StatCard label="Games This Week"        value={stats.activity.gamesPlayedThisWeek}   color="#0ea5e9" />
        <StatCard label="Games All Time"         value={stats.activity.gamesPlayedAllTime}    color="#8b5cf6" />
        <StatCard label="Avg Rounds / Game"      value={stats.activity.averageRoundsPerGame}  color="#8b5cf6" />
      </div>

      <h3 style={{ margin: '0 0 14px', color: '#475569', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
        Live Rooms
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Waiting"     value={stats.rooms.waiting}    color="#f59e0b" />
        <StatCard label="Ready"       value={stats.rooms.ready}      color="#22c55e" />
        <StatCard label="In Progress" value={stats.rooms.inProgress} color="#ef4444" />
      </div>

      <h3 style={{ margin: '0 0 14px', color: '#475569', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
        Scenario Breakdown
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 16 }}>
        <StatCard label="Scenario A (Hidden Rung)" value={stats.gameBreakdown.scenario_A || 0} color="#64748b" />
        <StatCard label="Scenario B (Open Rung)"   value={stats.gameBreakdown.scenario_B || 0} color="#64748b" />
      </div>
    </div>
  )
}
