'use client'
// DealingAnimation — Modern physics-based card dealing.
// Cards fly one-by-one from a deck pile at the table centre to each player's
// seat area on the felt surface.
//
// Layout assumptions (camera [0,6.2,5.8] fov:48):
//   Profile avatars sit at the container EDGES — felt zone is inward.
//   North avatar: top:12px  |  East: right:12px  |  West: left:12px  |  South: bottom:132px
//
// Each card uses a TWO-DIV trick:
//   Outer div — absolute position at the SEAT (with centering transform)
//   Inner div — CSS animation that starts at the DECK-OFFSET and ends at 0
// This avoids the centering-transform vs animation-transform conflict.

import { useEffect, useState } from 'react'
import React from 'react'

// ── Seat wrapper: absolute position on the felt, away from edge avatars ───────
const SEAT_WRAP: Record<number, React.CSSProperties> = {
  0: { position:'absolute', bottom:'28%',  left:'50%',  transform:'translateX(-50%)', zIndex:15 },
  1: { position:'absolute', top:'44%',     right:'27%', transform:'translateY(-50%)', zIndex:15 },
  2: { position:'absolute', top:'27%',     left:'50%',  transform:'translateX(-50%)', zIndex:15 },
  3: { position:'absolute', top:'44%',     left:'27%',  transform:'translateY(-50%)', zIndex:15 },
}

// ── Animation name per seat (keyframes defined in <style> tag below) ──────────
const ANIM_NAME: Record<number, string> = {
  0: 'deal-to-south',
  1: 'deal-to-east',
  2: 'deal-to-north',
  3: 'deal-to-west',
}

const LABEL: Record<number, string> = { 0:'You', 1:'East', 2:'North', 3:'West' }
const S2S: Record<number, number>   = { 0:0, 1:3, 2:2, 3:1 }
const SERVER_CCW                     = [0, 3, 2, 1]  // deal order: CCW from South

interface Props { batch: 1|2|3; cardsPerPlayer: number; onComplete: () => void }

interface CardItem {
  id: string
  seat: number
  tilt: number   // final resting tilt ±3°
}

export default function DealingAnimation({ batch, cardsPerPlayer, onComplete }: Props) {
  const [cards,       setCards]       = useState<CardItem[]>([])
  const [totalDealt,  setTotalDealt]  = useState(0)

  const total  = cardsPerPlayer * 4
  const perMs  = 130    // ms between individual card deals
  const animMs = 420    // single-card flight duration

  useEffect(() => {
    // Build deal sequence: round-robin CCW from South
    const sequence: number[] = []
    for (let r = 0; r < cardsPerPlayer; r++)
      for (const sp of SERVER_CCW) sequence.push(S2S[sp])

    const timers = sequence.map((seat, i) =>
      setTimeout(() => {
        const tilt = (Math.random() - 0.5) * 6   // ±3°
        setCards(prev => [...prev, { id: `c${i}`, seat, tilt }])
        setTotalDealt(d => d + 1)
      }, i * perMs)
    )
    const done = setTimeout(onComplete, total * perMs + animMs + 500)
    return () => { timers.forEach(clearTimeout); clearTimeout(done) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = Math.max(0, total - totalDealt)

  return (
    <div style={{ position:'absolute', inset:0, zIndex:25, pointerEvents:'none' }}>

      {/* Subtle table dim */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.22)', borderRadius:'inherit' }} />

      {/* ── Batch label ─────────────────────────────────────────────────────── */}
      <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)', zIndex:30, whiteSpace:'nowrap' }}>
        <div style={{
          background:'rgba(8,6,26,0.94)',
          border:'1px solid rgba(232,192,74,0.55)',
          borderRadius:999, padding:'6px 22px',
          color:'#e8c04a', fontWeight:700, fontSize:13, letterSpacing:1,
        }}>
          🃏 Batch {batch} of 3 · {cardsPerPlayer} cards each
        </div>
      </div>

      {/* ── Deck pile at table centre ────────────────────────────────────────── */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        transform:'translate(-50%,-60%)',
        zIndex:20,
      }}>
        {/* Stacked card backs */}
        <div style={{ position:'relative', width:52, height:74 }}>
          {Array.from({ length: Math.min(remaining, 8) }).map((_, i, arr) => (
            <div key={i} style={{
              position:'absolute',
              top:  -i * 1.6,
              left: -i * 0.9,
              zIndex: i,
            }}>
              <CardBack tilt={0} shine={i === arr.length - 1} />
            </div>
          ))}
          {remaining === 0 && (
            <div style={{
              width:52, height:74, borderRadius:7,
              background:'rgba(255,255,255,0.06)',
              border:'1.5px dashed rgba(255,255,255,0.18)',
            }} />
          )}
        </div>
        <div style={{ textAlign:'center', marginTop:8, color:'rgba(255,255,255,0.38)', fontSize:11, whiteSpace:'nowrap' }}>
          {remaining > 0 ? `${remaining} remaining` : 'Dealt!'}
        </div>
      </div>

      {/* ── Card piles at each seat ──────────────────────────────────────────── */}
      {([0,1,2,3] as const).map(seat => {
        const seatCards = cards.filter(c => c.seat === seat)
        if (seatCards.length === 0) return null
        const isMe    = seat === 0
        const animName = ANIM_NAME[seat]
        const dur      = animMs

        return (
          <div key={seat} style={SEAT_WRAP[seat]}>

            {/* Stacked card pile — each card animates from deck on mount */}
            <div style={{ position:'relative', width:52, height:74 }}>
              {seatCards.map((card, idx) => (
                <div key={card.id} style={{
                  position:'absolute',
                  top:  -idx * 2,
                  left:  idx * 0.8,
                  zIndex: idx,
                  animation: `${animName} ${dur}ms cubic-bezier(0.15,0.85,0.25,1.08) both`,
                }}>
                  <CardBack tilt={card.tilt} shine={idx === seatCards.length - 1} />
                </div>
              ))}
            </div>

            {/* Progress badge */}
            <div style={{
              marginTop:7, textAlign:'center', whiteSpace:'nowrap',
              background: isMe ? 'rgba(232,192,74,0.18)' : 'rgba(10,8,30,0.88)',
              border:`1px solid ${isMe ? 'rgba(232,192,74,0.55)' : 'rgba(255,255,255,0.18)'}`,
              borderRadius:999, padding:'3px 12px',
              color: isMe ? '#e8c04a' : 'rgba(255,255,255,0.75)',
              fontSize:11, fontWeight:700,
            }}>
              {isMe ? '👤' : '🤖'} {LABEL[seat]} · {seatCards.length}/{cardsPerPlayer}
            </div>

          </div>
        )
      })}

      {/* ── CSS keyframes: cards fly FROM deck centre TO each seat ──────────── */}
      {/* The outer SEAT_WRAP positions the card at the seat.                   */}
      {/* The keyframe starts with a translate BACK to the deck position        */}
      {/* (negative offset = towards deck) and ends at translateX/Y(0).         */}
      {/*                                                                        */}
      {/* Offset estimates (vmin):                                               */}
      {/*   South ← deck is ~20vmin above south seat                            */}
      {/*   North ← deck is ~16vmin below north seat                            */}
      {/*   East  ← deck is ~26vmin left  of east seat                          */}
      {/*   West  ← deck is ~26vmin right of west seat                          */}
      <style>{`
        @keyframes deal-to-south {
          0%   { transform: translateY(-20vmin) rotate(-14deg) scale(0.48); opacity:0; }
          12%  { opacity:1; }
          62%  { transform: translateY(3vmin) rotate(2.5deg) scale(1.07); }
          84%  { transform: translateY(-0.8vmin) rotate(0.5deg) scale(0.97); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
        }
        @keyframes deal-to-north {
          0%   { transform: translateY(16vmin) rotate(12deg) scale(0.48); opacity:0; }
          12%  { opacity:1; }
          62%  { transform: translateY(-2.5vmin) rotate(-2deg) scale(1.07); }
          84%  { transform: translateY(0.8vmin) rotate(-0.4deg) scale(0.97); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
        }
        @keyframes deal-to-east {
          0%   { transform: translateX(-26vmin) rotate(17deg) scale(0.48); opacity:0; }
          12%  { opacity:1; }
          62%  { transform: translateX(2.5vmin) rotate(-2.5deg) scale(1.07); }
          84%  { transform: translateX(-0.8vmin) rotate(0.5deg) scale(0.97); }
          100% { transform: translateX(0) rotate(0deg) scale(1); }
        }
        @keyframes deal-to-west {
          0%   { transform: translateX(26vmin) rotate(-17deg) scale(0.48); opacity:0; }
          12%  { opacity:1; }
          62%  { transform: translateX(-2.5vmin) rotate(2.5deg) scale(1.07); }
          84%  { transform: translateX(0.8vmin) rotate(-0.4deg) scale(0.97); }
          100% { transform: translateX(0) rotate(0deg) scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Card back — matches the ShuffleDealer deck exactly ───────────────────────
// Deep navy + gold filigree diamond, double border, gloss shine
function CardBack({ tilt = 0, shine = false }: { tilt?: number; shine?: boolean }) {
  const W = 52, H = 74
  return (
    <div style={{ transform: `rotate(${tilt}deg)`, flexShrink: 0,
                  boxShadow: '0 5px 18px rgba(0,0,0,0.65)', borderRadius: 8 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
           xmlns="http://www.w3.org/2000/svg"
           style={{ display:'block', borderRadius:8, overflow:'hidden' }}>
        <defs>
          <linearGradient id="da-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#0f1b3d" />
            <stop offset="50%"  stopColor="#091530" />
            <stop offset="100%" stopColor="#060d20" />
          </linearGradient>
          <linearGradient id="da-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#f0c040" />
            <stop offset="50%"  stopColor="#d4a017" />
            <stop offset="100%" stopColor="#b8860b" />
          </linearGradient>
          <linearGradient id="da-shine" x1="0%" y1="0%" x2="30%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.22)" />
            <stop offset="45%"  stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
          </linearGradient>
          <clipPath id="da-clip"><rect width={W} height={H} rx={8} ry={8} /></clipPath>
        </defs>
        {/* Base */}
        <rect width={W} height={H} rx={8} fill="url(#da-bg)" />
        {/* Outer gold border */}
        <rect x={3} y={3} width={W-6} height={H-6} rx={6}
              fill="none" stroke="url(#da-gold)" strokeWidth={1.2} opacity={0.85} />
        {/* Inner gold border */}
        <rect x={6} y={6} width={W-12} height={H-12} rx={4}
              fill="none" stroke="url(#da-gold)" strokeWidth={0.7} opacity={0.5} />
        {/* Centre filigree */}
        <g transform={`translate(${W/2},${H/2})`}>
          <polygon points={`0,${-H*0.22} ${W*0.16},0 0,${H*0.22} ${-W*0.16},0`}
                   fill="none" stroke="url(#da-gold)" strokeWidth={1} opacity={0.7} />
          <polygon points={`0,${-H*0.13} ${W*0.09},0 0,${H*0.13} ${-W*0.09},0`}
                   fill="none" stroke="url(#da-gold)" strokeWidth={0.8} opacity={0.55} />
          <text textAnchor="middle" dominantBaseline="central"
                fontSize={H * 0.14} fill="url(#da-gold)" opacity={0.8}
                fontFamily="Georgia, serif">♦</text>
          <line x1={-W*0.16} y1={0} x2={W*0.16} y2={0}
                stroke="url(#da-gold)" strokeWidth={0.6} opacity={0.3} />
          <line x1={0} y1={-H*0.22} x2={0} y2={H*0.22}
                stroke="url(#da-gold)" strokeWidth={0.6} opacity={0.3} />
        </g>
        {/* Corner pips */}
        <text x={7} y={16} fontSize={H*0.11} fill="url(#da-gold)" opacity={0.65}
              fontFamily="Georgia, serif">♦</text>
        <text x={W-7} y={H-7} fontSize={H*0.11} fill="url(#da-gold)" opacity={0.65}
              fontFamily="Georgia, serif" textAnchor="middle"
              transform={`rotate(180,${W-7},${H-10})`}>♦</text>
        {/* Dot grid */}
        <pattern id="da-dots" x={0} y={0} width={6} height={6} patternUnits="userSpaceOnUse">
          <circle cx={3} cy={3} r={0.6} fill="rgba(255,255,255,0.04)" />
        </pattern>
        <rect width={W} height={H} rx={8} fill="url(#da-dots)" />
        {/* Shine */}
        {shine && (
          <rect width={W} height={H*0.55} rx={8}
                fill="url(#da-shine)" clipPath="url(#da-clip)" />
        )}
      </svg>
    </div>
  )
}
