'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/services/api.service'
import Spinner from '@/components/ui/Spinner'

export default function LandingPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [guestLoading, setGuestLoading] = useState(false)

  /** Create guest account → go to lobby */
  const handleGuest = async () => {
    setGuestLoading(true)
    try {
      const { data } = await authApi.guest()
      setAuth(data.user, data.accessToken)
      router.push('/lobby')
    } catch {
      setGuestLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center
                    bg-gradient-to-br from-slate-950 via-slate-900 to-felt-dark p-4">

      {/* Logo */}
      <div className="text-center mb-10 animate-slide-up">
        <div className="text-7xl mb-4">🎴</div>
        <h1 className="text-5xl font-bold font-game text-gold mb-2 tracking-wide">Band Rang</h1>
        <p className="text-slate-400 text-lg">The classic closed rung card game — online</p>
        <div className="flex gap-3 justify-center mt-4 text-2xl">
          <span>♠️</span><span>♥️</span><span>♦️</span><span>♣️</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-sm space-y-3 animate-slide-up">

        <button
          onClick={handleGuest}
          disabled={guestLoading}
          className="btn-secondary flex items-center justify-center gap-2 text-sm">
          {guestLoading ? <Spinner size="sm" /> : '👤'} Browse Lobby as Guest
        </button>

        <Link href="/login"
          className="btn-secondary flex items-center justify-center gap-2 text-sm">
          🔑 Log In
        </Link>

        <Link href="/register"
          className="btn-secondary flex items-center justify-center gap-2 text-sm
                     border-gold/30 text-gold hover:bg-gold/10">
          ✨ Create Account
        </Link>
      </div>

      {/* Features */}
      <div className="mt-14 grid grid-cols-3 gap-6 max-w-lg text-center animate-slide-up">
        {[
          { icon: '👥', label: '4 Player',    sub: 'team vs team'       },
          { icon: '🤖', label: 'AI Opponents', sub: 'easy / medium / hard' },
          { icon: '🏆', label: 'Leaderboard',  sub: 'track your wins'    },
        ].map(f => (
          <div key={f.label} className="text-slate-400">
            <div className="text-3xl mb-1">{f.icon}</div>
            <div className="text-slate-200 font-semibold text-sm">{f.label}</div>
            <div className="text-xs mt-0.5">{f.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
