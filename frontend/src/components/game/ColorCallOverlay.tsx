'use client'
import { Suit } from '@/types/game.types'

interface Props {
  isRungHolder: boolean
  onCall: (suit: Suit) => void
  onPass: () => void
}

const SUITS: {
  suit: Suit; symbol: string; label: string
  bg: string; border: string; glow: string; symColor: string; nameColor: string
}[] = [
  {
    suit: 'spades',
    symbol: '♠', label: 'Spades',
    bg: 'linear-gradient(135deg,#1e2a3a 0%,#0f172a 100%)',
    border: 'rgba(148,163,184,0.4)',
    glow: 'rgba(148,163,184,0.25)',
    symColor: '#e2e8f0',
    nameColor: '#94a3b8',
  },
  {
    suit: 'hearts',
    symbol: '♥', label: 'Hearts',
    bg: 'linear-gradient(135deg,#4a0a1a 0%,#7f1d1d 100%)',
    border: 'rgba(248,113,113,0.45)',
    glow: 'rgba(220,38,38,0.3)',
    symColor: '#fca5a5',
    nameColor: '#f87171',
  },
  {
    suit: 'diamonds',
    symbol: '♦', label: 'Diamonds',
    bg: 'linear-gradient(135deg,#451a03 0%,#78350f 100%)',
    border: 'rgba(251,191,36,0.45)',
    glow: 'rgba(245,158,11,0.3)',
    symColor: '#fcd34d',
    nameColor: '#fbbf24',
  },
  {
    suit: 'clubs',
    symbol: '♣', label: 'Clubs',
    bg: 'linear-gradient(135deg,#0f2a1a 0%,#052e16 100%)',
    border: 'rgba(52,211,153,0.4)',
    glow: 'rgba(16,185,129,0.25)',
    symColor: '#6ee7b7',
    nameColor: '#34d399',
  },
]

export default function ColorCallOverlay({ isRungHolder, onCall, onPass }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, rgba(10,4,28,0.92) 0%, rgba(0,0,0,0.97) 100%)',
      backdropFilter: 'blur(12px)',
    }}>
      {/* Ambient glow orbs */}
      <div style={{ position:'absolute', top:'20%', left:'20%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'20%', right:'20%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(220,38,38,0.10) 0%, transparent 70%)', pointerEvents:'none' }} />

      <div style={{
        background: 'linear-gradient(145deg, rgba(20,10,40,0.98) 0%, rgba(10,5,25,0.98) 100%)',
        borderRadius: 24,
        border: '1px solid rgba(139,92,246,0.3)',
        boxShadow: '0 0 60px rgba(139,92,246,0.2), 0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.07)',
        padding: '36px 32px',
        maxWidth: 420,
        width: '100%',
        margin: '0 16px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top shimmer line */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(220,38,38,0.4), transparent)' }} />

        {/* Icon */}
        <div style={{ textAlign:'center', marginBottom: 16 }}>
          <div style={{
            display: 'inline-flex', alignItems:'center', justifyContent:'center',
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(220,38,38,0.15))',
            border: '1px solid rgba(139,92,246,0.4)',
            fontSize: 28,
            boxShadow: '0 0 24px rgba(139,92,246,0.3)',
          }}>🎴</div>
        </div>

        <h2 style={{ textAlign:'center', fontSize: 22, fontWeight: 800, color:'#f1f5f9', marginBottom: 6, letterSpacing: '-0.3px' }}>
          Color Call
        </h2>

        {isRungHolder ? (
          <>
            <p style={{ textAlign:'center', color:'#a78bfa', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              You are the Rung Holder
            </p>
            <p style={{ textAlign:'center', color:'#94a3b8', fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
              Ask your opponents:{' '}
              <span style={{ color:'#fcd34d', fontStyle:'italic' }}>"Does anyone want to call the color?"</span>
            </p>
            <p style={{ textAlign:'center', color:'#64748b', fontSize: 12, marginBottom: 28, lineHeight: 1.5 }}>
              If nobody calls, the trump suit stays hidden (Scenario A).
            </p>
            <button onClick={onPass} style={{
              width: '100%', padding: '14px 0',
              background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
              border: '1px solid rgba(96,165,250,0.4)',
              borderRadius: 14,
              color: '#dbeafe',
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(29,78,216,0.35), 0 4px 16px rgba(0,0,0,0.4)',
              transition: 'all 0.2s',
              letterSpacing: '0.3px',
            }}
              onMouseEnter={e => {(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 30px rgba(59,130,246,0.5), 0 6px 20px rgba(0,0,0,0.4)'}}
              onMouseLeave={e => {(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(29,78,216,0.35), 0 4px 16px rgba(0,0,0,0.4)'}}
            >
              🤫 Nobody Called — Start with Hidden Rung
            </button>
          </>
        ) : (
          <>
            <p style={{ textAlign:'center', color:'#94a3b8', fontSize: 13, marginBottom: 4 }}>
              The Rung Holder is asking:
            </p>
            <p style={{ textAlign:'center', color:'#fcd34d', fontSize: 14, fontStyle:'italic', marginBottom: 20 }}>
              "Does anyone want to call the color?"
            </p>

            {/* 2×2 suit grid */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12, marginBottom: 16 }}>
              {SUITS.map(s => (
                <button key={s.suit} onClick={() => onCall(s.suit)} style={{
                  padding: '20px 12px',
                  background: s.bg,
                  border: `1.5px solid ${s.border}`,
                  borderRadius: 16,
                  cursor: 'pointer',
                  display: 'flex', flexDirection:'column', alignItems:'center', gap: 6,
                  transition: 'all 0.18s cubic-bezier(.34,1.56,.64,1)',
                  boxShadow: `0 4px 20px ${s.glow}, 0 2px 8px rgba(0,0,0,0.4)`,
                  position: 'relative', overflow: 'hidden',
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.transform = 'translateY(-3px) scale(1.04)'
                    el.style.boxShadow = `0 8px 30px ${s.glow}, 0 4px 12px rgba(0,0,0,0.5)`
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement
                    el.style.transform = 'translateY(0) scale(1)'
                    el.style.boxShadow = `0 4px 20px ${s.glow}, 0 2px 8px rgba(0,0,0,0.4)`
                  }}
                >
                  {/* Shine */}
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:'40%', background:'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)', borderRadius:'14px 14px 0 0' }} />
                  <span style={{ fontSize: 38, color: s.symColor, lineHeight: 1, textShadow: `0 0 20px ${s.symColor}66` }}>
                    {s.symbol}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.nameColor, letterSpacing: '0.8px', textTransform:'uppercase' }}>
                    {s.label}
                  </span>
                </button>
              ))}
            </div>

            <button onClick={onPass} style={{
              width: '100%', padding: '11px 0',
              background: 'transparent',
              border: '1px solid rgba(71,85,105,0.5)',
              borderRadius: 12,
              color: '#64748b',
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(100,116,139,0.6)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = '#64748b'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(71,85,105,0.5)'
              }}
            >
              Pass — I don't want to call
            </button>
          </>
        )}
      </div>
    </div>
  )
}
