'use client'
/**
 * ShuffleDealer — on-table widget with premium riffle-shuffle animation.
 * Rich card-back graphics: deep navy + gold filigree inlay, gloss shine,
 * realistic stacking depth, smooth spring physics on split/merge.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'

interface Props { dealingTeam: string; onDeal: () => void }

type Phase = 'idle' | 'split' | 'cascade' | 'merge' | 'done'

const HALF      = 8    // cards per half-deck
const CW        = 52   // card width  px
const CH        = 76   // card height px
const STACK_GAP = 1.8  // px offset per stacked card

// ── Card-back SVG (inline, no external file needed) ───────────────────────────
// Deep navy + gold filigree diamond pattern, corner pips
const CardBackSVG = ({ w, h, shine = true }: { w: number; h: number; shine?: boolean }) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg"
       style={{ display: 'block', borderRadius: 8, overflow: 'hidden' }}>
    <defs>
      {/* Background gradient: deep navy to midnight blue */}
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#0f1b3d" />
        <stop offset="50%"  stopColor="#091530" />
        <stop offset="100%" stopColor="#060d20" />
      </linearGradient>
      {/* Gold filigree gradient */}
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#f0c040" />
        <stop offset="50%"  stopColor="#d4a017" />
        <stop offset="100%" stopColor="#b8860b" />
      </linearGradient>
      {/* Shine overlay */}
      <linearGradient id="shineGrad" x1="0%" y1="0%" x2="30%" y2="100%">
        <stop offset="0%"   stopColor="rgba(255,255,255,0.22)" />
        <stop offset="45%"  stopColor="rgba(255,255,255,0.04)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
      </linearGradient>
      <clipPath id={`card-clip-${w}-${h}`}>
        <rect width={w} height={h} rx={8} ry={8} />
      </clipPath>
    </defs>

    {/* Base fill */}
    <rect width={w} height={h} rx={8} fill="url(#bgGrad)" />

    {/* Outer gold border inset */}
    <rect x={3} y={3} width={w-6} height={h-6} rx={6}
          fill="none" stroke="url(#goldGrad)" strokeWidth={1.2} opacity={0.85} />

    {/* Inner gold border */}
    <rect x={6} y={6} width={w-12} height={h-12} rx={4}
          fill="none" stroke="url(#goldGrad)" strokeWidth={0.7} opacity={0.5} />

    {/* Centre diamond filigree */}
    <g transform={`translate(${w/2},${h/2})`}>
      {/* Large diamond */}
      <polygon points={`0,${-h*0.22} ${w*0.16},0 0,${h*0.22} ${-w*0.16},0`}
               fill="none" stroke="url(#goldGrad)" strokeWidth={1} opacity={0.7} />
      {/* Inner diamond */}
      <polygon points={`0,${-h*0.13} ${w*0.09},0 0,${h*0.13} ${-w*0.09},0`}
               fill="none" stroke="url(#goldGrad)" strokeWidth={0.8} opacity={0.55} />
      {/* Centre pip */}
      <text textAnchor="middle" dominantBaseline="central"
            fontSize={h * 0.14} fill="url(#goldGrad)" opacity={0.8}
            fontFamily="Georgia, serif">♦</text>
      {/* Cross lines */}
      <line x1={-w*0.16} y1={0} x2={w*0.16} y2={0}
            stroke="url(#goldGrad)" strokeWidth={0.6} opacity={0.3} />
      <line x1={0} y1={-h*0.22} x2={0} y2={h*0.22}
            stroke="url(#goldGrad)" strokeWidth={0.6} opacity={0.3} />
    </g>

    {/* Corner rank pips (top-left & bottom-right rotated) */}
    <text x={7} y={16} fontSize={h * 0.11} fill="url(#goldGrad)" opacity={0.65}
          fontFamily="Georgia, serif">♦</text>
    <text x={w-7} y={h-7} fontSize={h * 0.11} fill="url(#goldGrad)" opacity={0.65}
          fontFamily="Georgia, serif" textAnchor="middle"
          transform={`rotate(180,${w-7},${h-10})`}>♦</text>

    {/* Subtle dot-grid texture */}
    <pattern id="dots" x={0} y={0} width={6} height={6} patternUnits="userSpaceOnUse">
      <circle cx={3} cy={3} r={0.6} fill="rgba(255,255,255,0.04)" />
    </pattern>
    <rect width={w} height={h} rx={8} fill="url(#dots)" />

    {/* Gloss shine overlay */}
    {shine && (
      <rect width={w} height={h * 0.55} rx={8}
            fill="url(#shineGrad)" clipPath={`url(#card-clip-${w}-${h})`} />
    )}
  </svg>
)

// ── Half-deck stack ────────────────────────────────────────────────────────────
function StackHalf({ half, count, phase, splitX }: {
  half: 'left' | 'right'; count: number; phase: Phase; splitX: number
}) {
  const isLeft    = half === 'left'
  const splitting = phase === 'split'
  const hidden    = phase === 'cascade' || phase === 'merge' || phase === 'done'
  const splitDX   = isLeft ? -(splitX + 10) : (splitX + 10)
  const rot       = isLeft ? -7 : 7

  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const offX = isLeft ? (count - 1 - i) * STACK_GAP : i * STACK_GAP
        const offY = isLeft ? (count - 1 - i) * STACK_GAP : i * STACK_GAP
        const tx   = splitX + offX + (splitting ? splitDX : 0)
        const ty   = offY

        return (
          <div key={`${half}-${i}`} style={{
            position: 'absolute',
            left: tx, top: ty,
            width: CW, height: CH,
            borderRadius: 8,
            opacity: hidden ? 0 : 1,
            transform: splitting ? `rotate(${rot}deg)` : 'rotate(0deg)',
            transition: [
              `left 0.32s cubic-bezier(.34,1.2,.64,1)`,
              `transform 0.32s ease`,
              `opacity 0.1s ease`,
            ].join(','),
            zIndex: i,
            boxShadow: splitting
              ? `${isLeft ? -6 : 6}px 12px 28px rgba(0,0,0,0.75), 0 0 0 1px rgba(212,160,23,0.25)`
              : '0 4px 14px rgba(0,0,0,0.6)',
          }}>
            <CardBackSVG w={CW} h={CH} shine={i === count - 1} />
          </div>
        )
      })}
    </>
  )
}

// ── Single cascade card during riffle ─────────────────────────────────────────
function CascadeCard({ index, total, phase, splitX }: {
  index: number; total: number; phase: Phase; splitX: number
}) {
  const fromLeft = index % 2 === 0
  const slot     = Math.floor(index / 2)
  const srcX     = fromLeft ? 0 : splitX * 2 + (total / 2) * STACK_GAP
  const srcY     = slot * STACK_GAP
  const dstX     = splitX + index * STACK_GAP
  const dstY     = index * STACK_GAP
  const merging  = phase === 'merge' || phase === 'done'
  const delay    = index * 34

  return (
    <div style={{
      position: 'absolute',
      left:  merging ? dstX : srcX,
      top:   merging ? dstY : srcY,
      width: CW, height: CH,
      borderRadius: 8,
      transform: merging ? 'rotate(0deg)' : `rotate(${fromLeft ? -7 : 7}deg)`,
      transition: [
        `left 0.34s cubic-bezier(.4,0,.2,1) ${delay}ms`,
        `top 0.34s cubic-bezier(.4,0,.2,1) ${delay}ms`,
        `transform 0.28s ease ${delay}ms`,
      ].join(','),
      zIndex: total - index,
      boxShadow: '0 5px 16px rgba(0,0,0,0.65)',
    }}>
      <CardBackSVG w={CW} h={CH} shine={false} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ShuffleDealer({ dealingTeam, onDeal }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    try {
      const a = new Audio('/sounds/shuffle.wav')
      a.volume = 0.75; a.preload = 'auto'
      audioRef.current = a
    } catch {}
    return () => { timers.current.forEach(clearTimeout) }
  }, [])

  const after = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms)
    timers.current.push(t)
  }, [])

  const doShuffle = useCallback(() => {
    if (phase !== 'idle' && phase !== 'done') return
    timers.current.forEach(clearTimeout); timers.current = []
    after(230, () => { try { audioRef.current?.play() } catch {} })
    setPhase('split')
    after(400,  () => setPhase('cascade'))
    after(1200, () => setPhase('merge'))
    after(1750, () => { setPhase('done'); setCount(c => c + 1) })
    after(2400, () => setPhase('idle'))
  }, [phase, after])

  const splitX = 52
  const totalW = CW + HALF * STACK_GAP
  const stageW = totalW + splitX * 2
  const stageH = CH + HALF * STACK_GAP + 10
  const animating = phase !== 'idle' && phase !== 'done'

  return (
    <div style={{
      position: 'absolute',
      left: '50%', top: '55%',
      transform: 'translate(-50%, -50%)',
      zIndex: 30,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      pointerEvents: 'auto',
    }}>

      {/* Team label */}
      <div style={{
        background: 'rgba(6,10,26,0.92)',
        border: '1px solid rgba(212,160,23,0.4)',
        borderRadius: 20, padding: '4px 18px',
        color: '#d4a017', fontWeight: 700, fontSize: 11,
        letterSpacing: '1.5px', textTransform: 'uppercase',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 0 18px rgba(212,160,23,0.12)',
      }}>
        Team {dealingTeam} Deals
      </div>

      {/* ── Animation stage ── */}
      <div
        onClick={doShuffle}
        title="Click to shuffle"
        style={{ position: 'relative', width: stageW, height: stageH, cursor: 'pointer' }}
      >
        {/* Left half-deck */}
        <StackHalf half="left"  count={HALF} phase={phase} splitX={splitX} />
        {/* Right half-deck */}
        <StackHalf half="right" count={HALF} phase={phase} splitX={splitX} />

        {/* Cascade / merge cards */}
        {(phase === 'cascade' || phase === 'merge' || phase === 'done') &&
          Array.from({ length: HALF * 2 }).map((_, i) => (
            <CascadeCard key={i} index={i} total={HALF * 2} phase={phase} splitX={splitX} />
          ))
        }

        {/* Idle clean deck with top card visible */}
        {phase === 'idle' && (
          <>
            {Array.from({ length: HALF }).map((_, i) => (
              <div key={`idle-${i}`} style={{
                position: 'absolute',
                left: splitX + i * STACK_GAP,
                top:  i * STACK_GAP,
                width: CW, height: CH, borderRadius: 8,
                boxShadow: i === HALF - 1
                  ? '0 8px 28px rgba(0,0,0,0.75), 0 0 0 1px rgba(212,160,23,0.3)'
                  : '0 2px 8px rgba(0,0,0,0.5)',
              }}>
                <CardBackSVG w={CW} h={CH} shine={i === HALF - 1} />
              </div>
            ))}
          </>
        )}

        {/* Pulse ring on idle */}
        {phase === 'idle' && (
          <div style={{
            position: 'absolute',
            left: splitX - 7, top: -7,
            width: CW + 14, height: CH + 14,
            borderRadius: 12,
            border: '1.5px solid rgba(212,160,23,0.35)',
            animation: 'deckRing 2.2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}

        {/* Shuffle count badge */}
        {count > 0 && (
          <div style={{
            position: 'absolute', bottom: -6, right: splitX - 14,
            background: 'rgba(6,10,26,0.92)', border: '1px solid rgba(212,160,23,0.3)',
            borderRadius: 8, padding: '1px 6px',
            fontSize: 9, color: 'rgba(212,160,23,0.7)', fontWeight: 700,
          }}>×{count}</div>
        )}
      </div>

      {/* ── Buttons ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Shuffle button */}
        <button
          onClick={doShuffle}
          disabled={animating}
          style={{
            background: animating
              ? 'rgba(30,20,60,0.6)'
              : 'linear-gradient(135deg,rgba(80,40,140,0.95),rgba(50,18,100,0.95))',
            border: animating
              ? '1px solid rgba(140,100,220,0.2)'
              : '1px solid rgba(180,130,255,0.45)',
            borderRadius: 11, padding: '9px 18px',
            color: animating ? 'rgba(255,255,255,0.25)' : '#d4b8ff',
            fontSize: 12, fontWeight: 700,
            cursor: animating ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            backdropFilter: 'blur(10px)',
            boxShadow: animating ? 'none' : '0 0 18px rgba(130,80,200,0.3), 0 4px 14px rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
          onMouseEnter={e => { if (!animating) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 28px rgba(160,100,255,0.5), 0 4px 14px rgba(0,0,0,0.55)' }}
          onMouseLeave={e => { if (!animating) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 18px rgba(130,80,200,0.3), 0 4px 14px rgba(0,0,0,0.55)' }}
        >
          🔀 {animating ? 'Shuffling…' : count === 0 ? 'Shuffle' : 'Shuffle Again'}
        </button>

        {/* Deal button */}
        <button
          onClick={onDeal}
          style={{
            background: 'linear-gradient(135deg,rgba(16,90,45,0.95),rgba(10,58,28,0.95))',
            border: '1px solid rgba(74,222,128,0.45)',
            borderRadius: 11, padding: '9px 18px',
            color: '#86efac', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.18s',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 16px rgba(34,197,94,0.22), 0 4px 14px rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
          onMouseEnter={e => {
            const b = e.currentTarget as HTMLButtonElement
            b.style.boxShadow = '0 0 28px rgba(74,222,128,0.55), 0 4px 14px rgba(0,0,0,0.55)'
            b.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={e => {
            const b = e.currentTarget as HTMLButtonElement
            b.style.boxShadow = '0 0 16px rgba(34,197,94,0.22), 0 4px 14px rgba(0,0,0,0.55)'
            b.style.transform = 'none'
          }}
        >
          🃏 Deal Cards
        </button>
      </div>

      <style>{`
        @keyframes deckRing {
          0%,100% { opacity:0.25; transform:scale(1)    }
          50%      { opacity:0.65; transform:scale(1.05) }
        }
      `}</style>
    </div>
  )
}
