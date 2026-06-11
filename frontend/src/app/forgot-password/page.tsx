'use client'
import { useState } from 'react'
import Link from 'next/link'
import { authApi } from '@/services/api.service'
import Alert from '@/components/ui/Alert'
import Spinner from '@/components/ui/Spinner'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
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
          <h1 className="text-2xl font-bold text-slate-100 mt-3">Forgot password</h1>
          <p className="text-slate-400 text-sm mt-1">
            Enter your email and we'll send a reset link
          </p>
        </div>

        <div className="auth-card">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">📬</div>
              <p className="text-slate-300 text-sm">
                If that email is registered, a reset link is on its way.
                Check your inbox (and spam folder).
              </p>
              <Link href="/login" className="btn-primary block text-center mt-6">
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              {error && <Alert type="error" message={error} onClose={() => setError('')} />}
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email address</label>
                  <input type="email" required autoComplete="email"
                    className="form-input" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <button type="submit" disabled={loading}
                  className="btn-primary flex items-center justify-center gap-2">
                  {loading ? <Spinner size="sm" /> : '📧'} Send Reset Link
                </button>
              </form>
              <p className="text-center text-sm text-slate-400 mt-6">
                Remember it?{' '}
                <Link href="/login" className="text-gold hover:text-gold-light font-medium">Log in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
