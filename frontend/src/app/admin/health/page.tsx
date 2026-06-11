'use client'
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL

function StatusBadge({ up }: { up: boolean }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 12px',
      background: up ? '#dcfce7' : '#fef2f2',
      color: up ? '#16a34a' : '#dc2626',
      borderRadius: 20, fontSize: 13, fontWeight: 600,
    }}>
      {up ? '● UP' : '● DOWN'}
    </span>
  )
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchHealth = () => {
    const token = localStorage.getItem('admin_token')
    setLoading(true)
    fetch(`${API}/admin/health`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setHealth(d); setLoading(false); setLastRefresh(new Date()) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchHealth() }, [])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>🩺 System Health</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Last checked: {lastRefresh.toLocaleTimeString()}</span>
          <button onClick={fetchHealth} style={{
            padding: '8px 16px', background: '#1e293b', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>
            Refresh
          </button>
        </div>
      </div>

      {loading && <p>Checking…</p>}

      {health && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 20 }}>

          {/* Overall Status */}
          <div style={{ background: health.status === 'healthy' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${health.status === 'healthy' ? '#bbf7d0' : '#fecaca'}`, borderRadius: 10, padding: 24 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b' }}>Overall Status</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: health.status === 'healthy' ? '#16a34a' : '#dc2626' }}>
              {health.status === 'healthy' ? '✅ Healthy' : '⚠️ Degraded'}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>{health.checkedAt}</p>
          </div>

          {/* PostgreSQL */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>PostgreSQL</p>
            <StatusBadge up={health.services.postgresql === 'up'} />
          </div>

          {/* Redis */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>Redis</p>
            <StatusBadge up={health.services.redis === 'up'} />
          </div>

          {/* Uptime */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b' }}>API Uptime</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{health.api.uptimeHours}h</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Node {health.api.nodeVersion}</p>
          </div>

          {/* Memory */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', gridColumn: 'span 2' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Memory Usage (MB)</p>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'RSS',        value: health.api.memoryMB.rss },
                { label: 'Heap Used',  value: health.api.memoryMB.heapUsed },
                { label: 'Heap Total', value: health.api.memoryMB.heapTotal },
              ].map(m => (
                <div key={m.label}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#94a3b8' }}>{m.label}</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{m.value} MB</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
