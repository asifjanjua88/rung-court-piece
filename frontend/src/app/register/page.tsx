'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import Alert from '@/components/ui/Alert'
import Spinner from '@/components/ui/Spinner'

export default function RegisterPage() {
  const { register } = useAuth()
  const [form, setForm]     = useState({ displayName: '', email: '', password: '', confirm: '' })
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const field = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await register(form.email, form.password, form.displayName)
      setSuccess(true)
    } catch (err: any) {
      const code = err?.response?.data?.error
      if (code === 'EMAIL_TAKEN') setError('This email is already registered.')
      else setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center
                    bg-gradient-to-br from-slate-950 to-slate-900 p-4">
      <div className="w-full max-w-md text-center auth-card animate-bounce-in">
        <div className="text-6xl mb-4">📧</div>
        <h2 className="text-2xl font-bold text-slate-100 mb-3">Check your inbox</h2>
        <p className="text-slate-400 text-sm mb-6">
          We sent a verification link to <strong className="text-slate-200">{form.email}</strong>.
          Click the link to activate your account.
        </p>
        <Link href="/login" className="btn-primary block text-center">Go to Login</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center
                    bg-gradient-to-br from-slate-950 to-slate-900 p-4">
      <div className="w-full max-w-md animate-slide-up">

        <div className="text-center mb-8">
          <Link href="/" className="text-4xl">🎴</Link>
          <h1 className="text-2xl font-bold text-slate-100 mt-3">Create account</h1>
          <p className="text-slate-400 text-sm mt-1">Join Band Rang and track your wins</p>
        </div>

        <div className="auth-card">
          {error && <Alert type="error" message={error} onClose={() => setError('')} />}

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
              <input type="text" required minLength={2} maxLength={30}
                className="form-input" placeholder="Your in-game name"
                value={form.displayName} onChange={field('displayName')} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input type="email" required autoComplete="email"
                className="form-input" placeholder="you@example.com"
                value={form.email} onChange={field('email')} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input type="password" required minLength={8} autoComplete="new-password"
                className="form-input" placeholder="Min. 8 characters"
                value={form.password} onChange={field('password')} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
              <input type="password" required autoComplete="new-password"
                className="form-input" placeholder="Repeat password"
                value={form.confirm} onChange={field('confirm')} />
            </div>

            <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2 mt-2">
              {loading ? <Spinner size="sm" /> : '✨'} Create Account
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-gold hover:text-gold-light font-medium">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
