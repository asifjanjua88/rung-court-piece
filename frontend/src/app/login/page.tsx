'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import Alert from '@/components/ui/Alert'
import Spinner from '@/components/ui/Spinner'

export default function LoginPage() {
  const { login } = useAuth()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
    } catch (err: any) {
      const code = err?.response?.data?.error
      if (code === 'INVALID_CREDENTIALS') setError('Invalid email or password.')
      else if (code === 'EMAIL_NOT_VERIFIED') setError('Please verify your email before logging in.')
      else setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center
                    bg-gradient-to-br from-slate-950 to-slate-900 p-4">
      <div className="w-full max-w-md animate-slide-up">

        <div className="text-center mb-8">
          <Link href="/" className="text-4xl">🎴</Link>
          <h1 className="text-2xl font-bold text-slate-100 mt-3">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-1">Log in to your Band Rang account</p>
        </div>

        <div className="auth-card">
          {error && <Alert type="error" message={error} onClose={() => setError('')} />}

          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email" required autoComplete="email"
                className="form-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <Link href="/forgot-password" className="text-xs text-gold hover:text-gold-light">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password" required autoComplete="current-password"
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2">
              {loading ? <Spinner size="sm" /> : '🔑'} Log In
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            No account?{' '}
            <Link href="/register" className="text-gold hover:text-gold-light font-medium">
              Create one
            </Link>
            {' '}or{' '}
            <Link href="/" className="text-gold hover:text-gold-light font-medium">
              play as guest
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
