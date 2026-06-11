'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL

export default function AdminLoginPage() {
  const router = useRouter()
  const [form, setForm]     = useState({ username: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); return }

      localStorage.setItem('admin_token', data.token)

      if (data.mustChangePassword) {
        router.push('/admin/change-password')
      } else {
        router.push('/admin/dashboard')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#1e293b',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 40,
        width: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
      }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>🎴 Band Rang</h1>
        <p style={{ margin: '0 0 28px', color: '#64748b', fontSize: 14 }}>Admin Panel</p>

        {error && (
          <div style={{
            background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
            borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Username</span>
            <input
              type="text" value={form.username} autoComplete="username"
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              style={{
                display: 'block', width: '100%', marginTop: 6, padding: '10px 12px',
                border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14,
                boxSizing: 'border-box',
              }}
              required
            />
          </label>

          <label style={{ display: 'block', marginBottom: 24 }}>
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Password</span>
            <input
              type="password" value={form.password} autoComplete="current-password"
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{
                display: 'block', width: '100%', marginTop: 6, padding: '10px 12px',
                border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14,
                boxSizing: 'border-box',
              }}
              required
            />
          </label>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '11px', background: loading ? '#94a3b8' : '#1e293b',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          Default: admin / Admin@1234 (you will be asked to change it)
        </p>
      </div>
    </div>
  )
}
