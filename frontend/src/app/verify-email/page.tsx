'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authApi } from '@/services/api.service'
import Spinner from '@/components/ui/Spinner'

function VerifyContent() {
  const params  = useSearchParams()
  const token   = params.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  if (status === 'loading') return (
    <div className="text-center py-8">
      <Spinner size="lg" />
      <p className="text-slate-400 mt-4 text-sm">Verifying your email…</p>
    </div>
  )

  if (status === 'success') return (
    <div className="text-center py-4 animate-bounce-in">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-xl font-bold text-slate-100 mb-2">Email Verified!</h2>
      <p className="text-slate-400 text-sm mb-6">Your account is active. You can now log in.</p>
      <Link href="/login" className="btn-primary block">Go to Login</Link>
    </div>
  )

  return (
    <div className="text-center py-4">
      <div className="text-5xl mb-4">❌</div>
      <h2 className="text-xl font-bold text-slate-100 mb-2">Link Expired</h2>
      <p className="text-slate-400 text-sm mb-6">
        This verification link has expired or already been used.
      </p>
      <Link href="/register" className="btn-primary block">Register Again</Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center
                    bg-gradient-to-br from-slate-950 to-slate-900 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="text-4xl">🎴</Link>
        </div>
        <div className="auth-card">
          <Suspense fallback={<Spinner />}>
            <VerifyContent />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
