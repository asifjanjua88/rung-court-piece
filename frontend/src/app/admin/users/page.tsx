'use client'
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL

export default function AdminUsersPage() {
  const [users, setUsers]     = useState<any[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [type, setType]       = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]         = useState('')

  const token = () => localStorage.getItem('admin_token')

  const fetchUsers = async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20', search, type })
    const res = await fetch(`${API}/admin/users?${params}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
    const data = await res.json()
    setUsers(data.data || [])
    setTotal(data.pagination?.total || 0)
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [page, search, type])

  const suspend = async (id: string, reason: string) => {
    await fetch(`${API}/admin/users/${id}/suspend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    setMsg('User suspended.')
    fetchUsers()
  }

  const unsuspend = async (id: string) => {
    await fetch(`${API}/admin/users/${id}/unsuspend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
    })
    setMsg('User unsuspended.')
    fetchUsers()
  }

  const deleteGuest = async (id: string) => {
    if (!confirm('Delete this guest account?')) return
    await fetch(`${API}/admin/users/${id}/guest`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` },
    })
    setMsg('Guest deleted.')
    fetchUsers()
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 22 }}>👥 Users</h2>

      {msg && (
        <div style={{
          background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13,
        }}>
          {msg}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          placeholder="Search name or email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, flex: 1 }}
        />
        <select
          value={type}
          onChange={e => { setType(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
        >
          <option value="">All types</option>
          <option value="email">Email</option>
          <option value="guest">Guest</option>
        </select>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
        {total} user{total !== 1 ? 's' : ''} found
      </p>

      {loading ? <p>Loading…</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                {['Display Name', 'Email', 'Type', 'Verified', 'Games', 'Suspended', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px' }}>{u.display_name}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{u.email || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      background: u.identity_type === 'email' ? '#dbeafe' : '#fef3c7',
                      color: u.identity_type === 'email' ? '#1d4ed8' : '#92400e',
                      borderRadius: 4, padding: '2px 8px', fontSize: 11,
                    }}>
                      {u.identity_type}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{u.is_verified ? '✅' : '❌'}</td>
                  <td style={{ padding: '10px 12px' }}>{u.games_played}</td>
                  <td style={{ padding: '10px 12px' }}>{u.is_suspended ? '🔴 Yes' : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!u.is_suspended ? (
                        <button
                          onClick={() => {
                            const r = prompt('Reason for suspension:')
                            if (r) suspend(u.id, r)
                          }}
                          style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => unsuspend(u.id)}
                          style={{ padding: '4px 10px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                        >
                          Unsuspend
                        </button>
                      )}
                      {u.identity_type === 'guest' && (
                        <button
                          onClick={() => deleteGuest(u.id)}
                          style={{ padding: '4px 10px', background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
        >
          ← Prev
        </button>
        <span style={{ fontSize: 13, color: '#64748b' }}>Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)} disabled={users.length < 20}
          style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, cursor: users.length < 20 ? 'not-allowed' : 'pointer' }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
