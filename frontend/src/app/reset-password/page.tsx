'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { authApi } from '@/services/api.service'
import Alert from '@/components/ui/Alert'
import Spinner from '@/components/ui/Spinner'

function ResetForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token  = params.get('token') || ''
  const [form, setForm]     = useState({ password: '', confirm: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    setError('')
    setLoading(true)
    try {
      await authApi.resetPassword({ token, password: form.password })
      router.push('/login?reset=1')
    } catch (err: any) {
      const code = err?.response?.data?.error
      if (code === 'TOKEN_INVALID_OR_EXPIRED')
        setError('This reset link has expired or already been used. Request a new one.')
      else setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return (
    <div className="text-center py-8">
      <p className="text-red-400">Invalid reset link.</p>
      <Link href="/forgot-password" className="text-gold mt-4 block">Request a new one</Link>
    </div>
  )

  return (
    <>
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
          <input type="password" required minLength={8} autoComplete="new-password"
            className="form-input" placeholder="Min. 8 characters"
            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Confirm New Password</label>
          <input type="password" required autoComplete="new-password"
            className="form-input" placeholder="Repeat password"
            value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
        </div>
        <button type="submit" disabled={loading}
          className="btn-primary flex items-center justify-center gap-2">
          {loading ? <Spinner size="sm" /> : '🔒'} Reset Password
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center
                    bg-gradient-to-br from-slate-950 to-slate-900 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="text-4xl">🎴</Link>
          <h1 className="text-2xl font-bold text-slate-100 mt-3">Reset password</h1>
          <p className="text-slate-400 text-sm mt-1">Choose a new password for your account</p>
        </div>
        <div className="auth-card">
          <Suspense fallback={<Spinner />}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
