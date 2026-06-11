'use client'
import React, { useState } from 'react'
import { Card } from '@/types/game.types'

interface PlayingCardProps {
  card?: Card
  faceDown?: boolean
  selected?: boolean
  disabled?: boolean
  dimmed?: boolean
  onClick?: () => void
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const SYM: Record<string, string> = { spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣' }

const SUIT_COLOR: Record<string, string> = {
  spades:   '#1a1a2e',
  clubs:    '#1a2a1a',
  hearts:   '#b91c1c',
  diamonds: '#b45309',
}

const SZ = {
  xs: { w: 38,  h: 55,  r: 9,  s: 9,  pip: 20 },
  sm: { w: 52,  h: 76,  r: 13, s: 12, pip: 30 },
  md: { w: 68,  h: 98,  r: 17, s: 15, pip: 40 },
  lg: { w: 84,  h: 120, r: 21, s: 19, pip: 52 },
}

export default function PlayingCard({
  card, faceDown = false, selected = false, disabled = false,
  dimmed = false, onClick, size = 'md',
}: PlayingCardProps & { size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const s        = SZ[size]
  const color    = card ? SUIT_COLOR[card.suit] : '#1a202c'
  const sym      = card ? SYM[card.suit] : ''
  const canClick = !!onClick && !disabled
  const isRed    = card ? (card.suit === 'hearts' || card.suit === 'diamonds') : false

  const [hovered, setHovered] = useState(false)

  const liftY   = size === 'sm' ? -14 : -18
  const isLifted = canClick && hovered
  const isGold   = selected || isLifted

  const base: React.CSSProperties = {
    width: s.w, height: s.h,
    position: 'relative',
    borderRadius: 9,
    flexShrink: 0,
    userSelect: 'none',
    cursor: canClick ? 'pointer' : 'default',
    opacity: disabled ? 0.42 : dimmed ? 0.3 : 1,
    transition: 'transform 0.14s cubic-bezier(.34,1.56,.64,1), box-shadow 0.14s ease, filter 0.14s ease',
    transform: selected
      ? 'translateY(-18px) scale(1.08)'
      : isLifted
        ? `translateY(${liftY}px) scale(1.07)`
        : 'translateY(0) scale(1)',
    boxShadow: selected
      ? '0 0 0 2.5px #f59e0b, 0 16px 36px rgba(0,0,0,0.7), 0 4px 8px rgba(0,0,0,0.3)'
      : isLifted
        ? '0 0 0 2px rgba(250,200,60,0.7), 0 16px 36px rgba(0,0,0,0.7), 0 0 18px rgba(250,200,60,0.25)'
        : '0 4px 14px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.25)',
    filter: isLifted && !selected ? 'brightness(1.06)' : 'none',
    zIndex: isLifted ? 10 : 'auto',
  }

  const handleEnter      = () => { if (!disabled) setHovered(true)  }
  const handleLeave      = () => setHovered(false)
  const handleClick      = () => { if (canClick) { setHovered(false); onClick?.() } }
  // Touch: lift on press, fire click on release (no hover state needed)
  const handleTouchStart = (e: React.TouchEvent) => { if (canClick) { e.preventDefault(); setHovered(true) } }
  const handleTouchEnd   = (e: React.TouchEvent) => { if (canClick) { e.preventDefault(); setHovered(false); onClick?.() } }

  /* ── Face-down ── */
  if (faceDown || !card) {
    return (
      <div style={base} onClick={canClick ? handleClick : undefined}
           onMouseEnter={handleEnter} onMouseLeave={handleLeave}
           onTouchStart={canClick ? handleTouchStart : undefined}
           onTouchEnd={canClick ? handleTouchEnd : undefined}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 9, overflow: 'hidden',
          background: 'linear-gradient(145deg, #1a0533 0%, #2d0a5e 40%, #1a0533 100%)',
          border: isGold ? '1.5px solid rgba(250,200,60,0.7)' : '2px solid rgba(180,130,255,0.4)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
        }}>
          <div style={{
            position: 'absolute', inset: 5, borderRadius: 5,
            border: '1px solid rgba(180,130,255,0.25)',
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 8px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 8px)',
          }} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: s.w * 0.46, color: 'rgba(180,130,255,0.35)', lineHeight: 1,
          }}>♦</div>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '38%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)',
            borderRadius: '7px 7px 0 0',
          }} />
        </div>
      </div>
    )
  }

  /* ── Face-up ── */
  return (
    <div style={base} onClick={canClick ? handleClick : undefined}
         onMouseEnter={handleEnter} onMouseLeave={handleLeave}
         onTouchStart={canClick ? handleTouchStart : undefined}
         onTouchEnd={canClick ? handleTouchEnd : undefined}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 9, overflow: 'hidden',
        background: 'linear-gradient(165deg, #ffffff 0%, #faf6f0 100%)',
        border: isGold
          ? '1.5px solid rgba(250,200,60,0.8)'
          : isRed ? '1.5px solid #fecdd3' : '1.5px solid #d1d5db',
      }}>
        {/* Inner glow for hover */}
        {isGold && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 9, pointerEvents: 'none',
            boxShadow: 'inset 0 0 12px rgba(250,200,60,0.18)',
          }} />
        )}
        {/* Shine overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '42%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, transparent 100%)',
          borderRadius: '7px 7px 0 0', pointerEvents: 'none',
        }} />

        {/* Top-left corner */}
        <div style={{ position:'absolute', top: 4, left: 5, lineHeight: 1.1, color }}>
          <div style={{ fontSize: s.r, fontWeight: 900, fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '-0.5px' }}>
            {card.rank}
          </div>
          <div style={{ fontSize: s.s, lineHeight: 1.1, fontWeight: 700 }}>{sym}</div>
        </div>

        {/* Centre pip */}
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <span style={{ fontSize: s.pip, color, opacity: 0.12, lineHeight: 1 }}>{sym}</span>
        </div>

        {/* Bottom-right corner rotated */}
        <div style={{ position:'absolute', bottom: 4, right: 5, lineHeight: 1.1, color, transform: 'rotate(180deg)' }}>
          <div style={{ fontSize: s.r, fontWeight: 900, fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '-0.5px' }}>
            {card.rank}
          </div>
          <div style={{ fontSize: s.s, lineHeight: 1.1, fontWeight: 700 }}>{sym}</div>
        </div>
      </div>

      {/* "Play" tooltip on hover */}
      {isLifted && (
        <div style={{
          position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(250,200,60,0.95)', color: '#1a0a00',
          fontSize: 9, fontWeight: 800, borderRadius: 6, padding: '2px 7px',
          whiteSpace: 'nowrap', pointerEvents: 'none', letterSpacing: '0.5px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}>
          PLAY ▼
        </div>
      )}
    </div>
  )
}
