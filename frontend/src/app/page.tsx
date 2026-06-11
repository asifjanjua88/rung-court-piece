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

  // Modal state
  const [showNameModal, setShowNameModal] = useState(false)
  const [guestName,     setGuestName]     = useState('')
  const [nameError,     setNameError]     = useState('')
  const [loading,       setLoading]       = useState(false)

  const openModal = () => {
    setGuestName('')
    setNameError('')
    setShowNameModal(true)
  }

  const handleGuest = async () => {
    const trimmed = guestName.trim()
    if (!trimmed) { setNameError('Please enter your name.'); return }
    if (trimmed.length < 2) { setNameError('Name must be at least 2 characters.'); return }
    if (trimmed.length > 20) { setNameError('Name must be 20 characters or less.'); return }
    if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
      setNameError('Only letters, numbers, spaces, _ and - are allowed.')
      return
    }

    setLoading(true)
    setNameError('')
    try {
      const { data } = await authApi.guest(trimmed)
      setAuth(data.user, data.accessToken)
      router.push('/lobby')
    } catch (err: any) {
      const code = err?.response?.data?.error
      if (code === 'NAME_TAKEN') {
        setNameError('This name is taken by a registered user. Try another name.')
      } else {
        setNameError('Something went wrong. Please try again.')
      }
      setLoading(false)
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
          onClick={openModal}
          className="btn-secondary flex items-center justify-center gap-2 text-sm w-full">
          👤 Browse Lobby as Guest
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

      {/* ── Name input modal ───────────────────────────────────────────────────── */}
      {showNameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNameModal(false) }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #0f0a2e 0%, #080618 100%)',
            border: '1px solid rgba(232,192,74,0.3)',
            borderRadius: 20,
            padding: '32px 28px',
            width: '100%',
            maxWidth: 380,
            boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          }}>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">👤</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>
                Enter Your Name
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                This name identifies you in the game.<br />
                Use the <strong style={{ color: 'rgba(232,192,74,0.8)' }}>same name</strong> to rejoin if you get disconnected.
              </p>
            </div>

            {/* Input */}
            <div className="mb-4">
              <input
                autoFocus
                type="text"
                value={guestName}
                onChange={e => { setGuestName(e.target.value); setNameError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleGuest() }}
                placeholder="e.g. Ali, Asif, Player1"
                maxLength={20}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: nameError
                    ? '1.5px solid rgba(239,68,68,0.7)'
                    : '1.5px solid rgba(232,192,74,0.3)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  color: '#f1f5f9',
                  fontSize: 16,
                  outline: 'none',
                  fontWeight: 600,
                  boxSizing: 'border-box',
                }}
              />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginTop: 5,
              }}>
                {nameError
                  ? <span style={{ color: '#f87171', fontSize: 12, fontWeight: 500 }}>⚠ {nameError}</span>
                  : <span />
                }
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                  {guestName.length}/20
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowNameModal(false)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.5)', fontSize: 14,
                  cursor: 'pointer', fontWeight: 600,
                }}>
                Cancel
              </button>
              <button
                onClick={handleGuest}
                disabled={loading || !guestName.trim()}
                style={{
                  flex: 2, padding: '11px 0', borderRadius: 10,
                  background: guestName.trim()
                    ? 'linear-gradient(135deg,#d4a017,#b8860b)'
                    : 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: guestName.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                  fontSize: 14,
                  cursor: guestName.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 800,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                }}>
                {loading ? <Spinner size="sm" /> : '🎮 Enter Lobby'}
              </button>
            </div>

            {/* Hint */}
            <p style={{
              textAlign: 'center', fontSize: 11,
              color: 'rgba(255,255,255,0.25)', marginTop: 14,
            }}>
              💡 Same name = same player. Rejoin any game just by using this name again.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
