'use client'
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL

const STATUS_COLORS: Record<string, string> = {
  waiting: '#f59e0b', ready: '#22c55e', in_progress: '#3b82f6', completed: '#94a3b8',
}

export default function AdminRoomsPage() {
  const [rooms, setRooms]   = useState<any[]>([])
  const [status, setStatus] = useState('')
  const [page, setPage]     = useState(1)
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]       = useState('')

  const token = () => localStorage.getItem('admin_token')

  const fetchRooms = async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20', ...(status && { status }) })
    const res = await fetch(`${API}/admin/rooms?${params}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
    const data = await res.json()
    setRooms(data.data || [])
    setTotal(data.pagination?.total || 0)
    setLoading(false)
  }

  useEffect(() => { fetchRooms() }, [page, status])

  const deleteRoom = async (id: string) => {
    if (!confirm('Force delete this room?')) return
    await fetch(`${API}/admin/rooms/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` },
    })
    setMsg('Room deleted.')
    fetchRooms()
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 22 }}>🏠 Rooms</h2>

      {msg && (
        <div style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
        >
          <option value="">All statuses</option>
          <option value="waiting">Waiting</option>
          <option value="ready">Ready</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <button onClick={fetchRooms} style={{ padding: '8px 16px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
          Refresh
        </button>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>{total} room{total !== 1 ? 's' : ''}</p>

      {loading ? <p>Loading…</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                {['Room ID', 'Type', 'Status', 'Creator', 'Slots', 'Human', 'Computer', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{r.id.slice(0, 8)}…</td>
                  <td style={{ padding: '10px 12px' }}>{r.type === 'public' ? '🌐' : '🔒'} {r.type}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      background: STATUS_COLORS[r.status] + '22',
                      color: STATUS_COLORS[r.status],
                      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{r.creator_name}</td>
                  <td style={{ padding: '10px 12px' }}>{r.filled_slots}/4</td>
                  <td style={{ padding: '10px 12px' }}>{r.human_slots}</td>
                  <td style={{ padding: '10px 12px' }}>{r.computer_slots}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => deleteRoom(r.id)}
                      style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
          ← Prev
        </button>
        <span style={{ fontSize: 13, color: '#64748b' }}>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={rooms.length < 20}
          style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, cursor: rooms.length < 20 ? 'not-allowed' : 'pointer' }}>
          Next →
        </button>
      </div>
    </div>
  )
}
