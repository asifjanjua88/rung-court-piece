'use client'
/**
 * GameTable2D — Pure CSS poker table, fully fills its container with no overflow.
 * All player chips + played cards are positioned absolutely.
 */

import React, { useEffect, useRef, useState } from 'react'
import type { Card, TrickCard, PlayerPublicInfo, GameState } from '@/types/game.types'
import PlayingCard from './PlayingCard'
import { useScreenSize } from '@/hooks/useScreenSize'

export interface TrickLayer { cards: TrickCard[]; winnerId: string | null }

export interface GameTable2DProps {
  currentTrick:    TrickCard[]
  trickHistory:    TrickLayer[]
  aiPlayers:       PlayerPublicInfo[]
  playerMap:       Record<string, PlayerPublicInfo>
  state:           GameState
  userId:          string
  isMyTurn:        boolean
  lastTrick:       { trickNumber: number; winnerId: string } | null
  /** The card the local player chose as hidden rung (only non-null for the rung holder) */
  hiddenRungCard:  Card | null
  /** Populated when the hidden rung gets revealed mid-game */
  rungRevealCard:  Card | null
  /** Live presence map: playerId → 'connected' | 'disconnected' */
  presence:        Record<string, 'connected' | 'disconnected'>
}

// Fixed absolute server-position → screen-seat map.
// This is the SAME for ALL viewers so every player sees the same table layout.
// Server pos 0 = South, 1 = West, 2 = North, 3 = East
// (Positions 0 & 2 are Team A partners; 1 & 3 are Team B partners)
const FIXED_S2S: Record<number, number> = { 0: 0, 1: 3, 2: 2, 3: 1 }

// Card slot positions — % of the ROOT table container.
// Oval spans top:7%→bottom:7% (felt), left:19%→right:19%.
// Cards pulled toward centre so they never overlap player chips at edges.
export const FELT_CARD_POS: Record<number, { left: string; top: string; rotate: number }> = {
  0: { left: '50%', top: '72%', rotate:  0 },   // South — pushed toward bottom of felt
  1: { left: '65%', top: '50%', rotate:  7 },   // East
  2: { left: '50%', top: '28%', rotate:  0 },   // North — pushed toward top of felt
  3: { left: '35%', top: '50%', rotate: -7 },   // West
}

// Rung card beside each holder's trick slot (offset from FELT_CARD_POS, never overlaps)
const RUNG_CARD_POS: Record<number, { left: string; top: string; rotate: number }> = {
  0: { left: '62%', top: '74%', rotate:  -8 },
  1: { left: '72%', top: '42%', rotate:  14 },
  2: { left: '38%', top: '22%', rotate:   8 },
  3: { left: '28%', top: '58%', rotate: -14 },
}

// ── Hidden rung card on the table ─────────────────────────────────────────────
function HiddenRungCard({
  isRungHolder, card, revealed, revealedCard, rungHolderSeat,
}: {
  isRungHolder:   boolean
  card:           Card | null   // only non-null for the rung holder (their own card)
  revealed:       boolean
  revealedCard:   Card | null
  rungHolderSeat: number        // screen seat (0=South,1=East,2=North,3=West)
}) {
  const [peeking,  setPeeking]  = useState(false)
  const [flipping, setFlipping] = useState(false)
  const [showFace, setShowFace] = useState(false)
  const prevRevealed = useRef(false)

  // Trigger flip animation when card is revealed
  useEffect(() => {
    if (revealed && !prevRevealed.current) {
      prevRevealed.current = true
      setFlipping(true)
      setTimeout(() => { setShowFace(true); setFlipping(false) }, 320)
    }
  }, [revealed])

  const pos = RUNG_CARD_POS[rungHolderSeat] ?? RUNG_CARD_POS[0]

  // What card to render
  const displayCard = revealed ? revealedCard : (isRungHolder ? card : null)
  const faceDown    = revealed ? showFace === false : !(isRungHolder && peeking)

  const SYM: Record<string, string> = { spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣' }
  const SUIT_CLR: Record<string, string> = { spades:'#e2e8f0', hearts:'#f87171', diamonds:'#fb923c', clubs:'#86efac' }
  const sym  = revealedCard ? SYM[revealedCard.suit] : ''
  const clr  = revealedCard ? SUIT_CLR[revealedCard.suit] : '#aaa'

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.left, top: pos.top,
        transform: `translate(-50%,-50%) rotate(${flipping ? 90 : pos.rotate}deg) scaleX(${flipping ? 0.05 : 1})`,
        transition: flipping
          ? 'transform 0.3s ease-in'
          : 'transform 0.3s ease-out',
        zIndex: 6,   // below trick cards (z:10) so played cards always appear on top
        cursor: isRungHolder && !revealed ? 'pointer' : 'default',
        filter: revealed ? 'drop-shadow(0 0 14px rgba(245,158,11,0.7))' : 'none',
      }}
      onMouseEnter={() => { if (isRungHolder && !revealed) setPeeking(true)  }}
      onMouseLeave={() => { if (isRungHolder && !revealed) setPeeking(false) }}
    >
      {/* Subtle zone marker behind the card */}
      <div style={{
        position: 'absolute', inset: -8, borderRadius: 12, zIndex: -1,
        background: revealed
          ? 'rgba(245,158,11,0.10)'
          : 'rgba(130,80,200,0.08)',
        border: revealed
          ? '1px solid rgba(245,158,11,0.25)'
          : '1px dashed rgba(130,80,200,0.25)',
      }} />
      <PlayingCard card={displayCard ?? undefined} faceDown={faceDown} size="sm" />

      {/* Label above the card */}
      <div style={{
        position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {revealed ? (
          // After reveal: "K♠ Rung!" banner
          <div style={{
            background: 'rgba(0,0,0,0.88)', border: `1px solid ${clr}66`,
            borderRadius: 8, padding: '2px 8px', fontSize: 10, fontWeight: 800,
            color: clr, letterSpacing: '0.3px',
          }}>
            {revealedCard?.rank}{sym} Rung!
          </div>
        ) : isRungHolder && peeking ? (
          // Rung holder peeking: "Only you can see this"
          <div style={{
            background: 'rgba(10,6,26,0.95)', border: '1px solid rgba(139,92,246,0.5)',
            borderRadius: 8, padding: '2px 8px', fontSize: 9, fontWeight: 700,
            color: '#c4b5fd',
          }}>
            👁 Only you see this
          </div>
        ) : isRungHolder ? (
          // Rung holder idle hint
          <div style={{
            background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '2px 7px', fontSize: 9,
            color: 'rgba(255,255,255,0.38)',
          }}>
            🔒 Your rung
          </div>
        ) : (
          // Others see only "Hidden rung"
          <div style={{
            background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '2px 7px', fontSize: 9,
            color: 'rgba(255,255,255,0.28)',
          }}>
            🔒 Hidden
          </div>
        )}
      </div>
    </div>
  )
}

// ── Face-down card stack ───────────────────────────────────────────────────────
function CardStack({ count }: { count: number }) {
  if (count === 0) return null
  const shown = Math.min(count, 7)
  return (
    <div style={{ position:'relative', width: 32+shown*2, height: 46+shown*2 }}>
      {Array.from({ length: shown }).map((_, i) => (
        <div key={i} style={{
          position:'absolute', left: i*2, top: i*2,
          width: 32, height: 46, borderRadius: 5,
          background: 'linear-gradient(145deg,#2d0d55,#1a0533)',
          border: '1.5px solid rgba(160,120,230,0.35)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.55)',
        }} />
      ))}
      <div style={{
        position:'absolute', bottom:-9, right:-5,
        background:'rgba(0,0,0,0.82)', border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:8, padding:'1px 5px',
        fontSize:9, color:'rgba(255,255,255,0.55)', fontWeight:700, whiteSpace:'nowrap',
      }}>×{count}</div>
    </div>
  )
}

// ── Player chip ────────────────────────────────────────────────────────────────
// compact=true: no separate card-stack column — card count shown as badge on
// the avatar. Reduces the chip's height to ~80px so North fits above the felt.
function Chip({
  name, seat, team, isLead, hasPlayed, cardCount, face,
  dir, compact = false, disconnected = false, small = false,
}: {
  name:string; seat:string; team:'A'|'B'; isLead:boolean; hasPlayed:boolean
  cardCount:number; face:string; dir:'top'|'bottom'|'left'|'right'
  compact?: boolean; disconnected?: boolean; small?: boolean
}) {
  const tc    = team === 'A' ? '#22d3ee' : '#fb923c'
  const isRow = dir === 'left' || dir === 'right'
  const av    = small ? 32 : 44   // avatar size: smaller on mobile

  const avatarAndName = (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: small ? 2 : 3 }}>
      <div style={{
        width:av, height:av, borderRadius:'50%', position:'relative', flexShrink:0,
        background: disconnected
          ? 'linear-gradient(135deg,#1a1a2e,#0f0f1a)'
          : (team==='A' ? 'linear-gradient(135deg,#0e4a5e,#0891b2)' : 'linear-gradient(135deg,#7c2d12,#ea580c)'),
        border: disconnected ? '2px solid rgba(239,68,68,0.7)' : (isLead ? `2px solid ${tc}` : '1.5px solid rgba(255,255,255,0.12)'),
        boxShadow: disconnected ? '0 0 14px rgba(239,68,68,0.4)' : (isLead ? `0 0 18px ${tc}88,0 0 36px ${tc}33` : '0 3px 12px rgba(0,0,0,0.6)'),
        display:'flex', alignItems:'center', justifyContent:'center', fontSize: small ? 14 : 20,
        opacity: disconnected ? 0.6 : 1,
      }}>
        {disconnected ? '📵' : face}
        {/* Played checkmark */}
        {hasPlayed && (
          <div style={{ position:'absolute', bottom:-2, right:-2, width:15, height:15, borderRadius:'50%', background:'#16a34a', border:'2px solid #000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, color:'#fff', fontWeight:800 }}>✓</div>
        )}
        {/* Compact mode: card count badge top-right of avatar */}
        {compact && cardCount > 0 && !hasPlayed && (
          <div style={{ position:'absolute', top:-5, right:-8, background:'rgba(0,0,0,0.9)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'1px 5px', fontSize:9, color:'rgba(255,255,255,0.65)', fontWeight:700, whiteSpace:'nowrap' }}>
            ×{cardCount}
          </div>
        )}
        {isLead && (
          <div style={{ position:'absolute', inset:-5, borderRadius:'50%', border:`2px solid ${tc}`, animation:'pingPulse 1.4s cubic-bezier(0,0,0.2,1) infinite' }} />
        )}
      </div>
      <div style={{
        background: isLead ? 'rgba(60,35,0,0.96)' : 'rgba(6,3,16,0.88)',
        backdropFilter:'blur(12px)',
        border: isLead ? `1px solid ${tc}44` : '1px solid rgba(255,255,255,0.08)',
        borderRadius:9, padding: small ? '2px 6px' : '4px 10px', textAlign:'center',
        boxShadow: isLead ? `0 0 14px ${tc}33` : '0 3px 12px rgba(0,0,0,0.5)',
        minWidth: small ? 52 : 74,
        maxWidth: small ? 72 : undefined,
      }}>
        <div style={{ fontSize: small ? 9 : 11, fontWeight:700, color:isLead?'#fde68a':'#f1f5f9', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {isLead ? '⭐ ' : ''}{small ? name.slice(0, 7) : name}
        </div>
        {!small && (
          <div style={{ fontSize:9, color: disconnected ? '#f87171' : 'rgba(255,255,255,0.35)', marginTop:1, letterSpacing:'0.3px' }}>
            {disconnected ? '⚠ Disconnected' : `${seat} · T${team}`}
          </div>
        )}
      </div>
    </div>
  )

  // Compact: just avatar+name (no separate stack column)
  if (compact) return avatarAndName

  return (
    <div style={{
      display:'flex',
      flexDirection: isRow ? (dir === 'right' ? 'row' : 'row-reverse') : (dir === 'top' ? 'column-reverse' : 'column'),
      alignItems:'center', gap: 6,
    }}>
      <CardStack count={cardCount} />
      {avatarAndName}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GameTable2D({ currentTrick, trickHistory, aiPlayers, playerMap, state, userId, isMyTurn, lastTrick, hiddenRungCard, rungRevealCard, presence }: GameTable2DProps) {

  const { isMobile, isTablet } = useScreenSize()
  const isSmall = isMobile || isTablet

  // SFX
  const cardSnd = useRef<HTMLAudioElement|null>(null)
  const winSnd  = useRef<HTMLAudioElement|null>(null)
  const prevLen = useRef(0)
  const prevLT  = useRef<number|null>(null)

  // Use the fixed absolute seat map — identical for every viewer.
  const S2S = FIXED_S2S

  useEffect(() => {
    try { cardSnd.current = new Audio('/sounds/card-play.wav'); cardSnd.current.volume = 0.55 } catch {}
    try { winSnd.current  = new Audio('/sounds/trick-win.wav');  winSnd.current.volume  = 0.65 } catch {}
  }, [])

  useEffect(() => {
    if (currentTrick.length > prevLen.current)
      try { const a = cardSnd.current?.cloneNode() as HTMLAudioElement; a?.play() } catch {}
    prevLen.current = currentTrick.length
  }, [currentTrick.length])

  useEffect(() => {
    if (lastTrick && lastTrick.trickNumber !== prevLT.current) {
      prevLT.current = lastTrick.trickNumber
      try { winSnd.current?.play() } catch {}
    }
  }, [lastTrick])

  // Use ALL players (including self) so chips appear at their true absolute seats.
  const getPlayer = (seat: number) => state.players.find(p => S2S[p.position] === seat)
  const south = getPlayer(0), north = getPlayer(2), east = getPlayer(1), west = getPlayer(3)

  return (
    // Fills the container div completely
    <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>

      {/* ── Wood outer body ──────────────────────────────────────────────────── */}
      {/* top/bottom 4% → taller oval = more vertical space between N/S players */}
      <div style={{
        position:'absolute',
        left:'16%', right:'16%', top:'4%', bottom:'4%',
        borderRadius:'50%',
        background:'radial-gradient(ellipse at 38% 28%,#7a3f18 0%,#3d1c08 45%,#1e0c03 100%)',
        boxShadow:'0 0 0 2px rgba(255,210,100,0.1), 0 12px 48px rgba(0,0,0,0.85), 0 32px 80px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,200,80,0.1)',
      }} />

      {/* ── Gold trim ────────────────────────────────────────────────────────── */}
      <div style={{
        position:'absolute',
        left:'17.5%', right:'17.5%', top:'5.5%', bottom:'5.5%',
        borderRadius:'50%',
        border:'1.5px solid rgba(212,168,67,0.50)',
        boxShadow:'0 0 10px rgba(212,168,67,0.15), inset 0 0 6px rgba(212,168,67,0.08)',
      }} />

      {/* ── Felt surface ─────────────────────────────────────────────────────── */}
      <div style={{
        position:'absolute',
        left:'19%', right:'19%', top:'7%', bottom:'7%',
        borderRadius:'50%',
        background:'radial-gradient(ellipse at 42% 35%,#1d6535 0%,#0f3d1e 42%,#07270f 72%,#031608 100%)',
        boxShadow:'inset 0 3px 20px rgba(0,0,0,0.5),inset 0 0 50px rgba(0,0,0,0.3)',
        overflow:'hidden',
      }}>
        {/* Felt weave */}
        <div style={{ position:'absolute', inset:0, opacity:0.04, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.6) 3px,rgba(255,255,255,0.6) 4px),repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(255,255,255,0.6) 3px,rgba(255,255,255,0.6) 4px)' }} />
        {/* Center light */}
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 50%,rgba(60,220,100,0.07) 0%,transparent 60%)' }} />
        {/* Watermark */}
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <span style={{ fontSize:13, color:'rgba(212,168,67,0.10)', fontWeight:900, letterSpacing:5, textTransform:'uppercase', userSelect:'none' }}>BAND RANG</span>
        </div>
      </div>

      {/* ── Trick history (dimmed old cards on felt) ─────────────────────────── */}
      {trickHistory.slice(-2).map((layer, li) =>
        layer.cards.map(tc => {
          // Look up directly from state.players — never fall back to seat 0 for unknowns
          const player = state.players.find(p => p.id === tc.playerId)
          if (!player) return null
          const seat = S2S[player.position] ?? 0
          const pos  = FELT_CARD_POS[seat]
          const age  = trickHistory.length - 1 - (trickHistory.length - 2 + li)
          return (
            <div key={`h${li}-${tc.playerId}`} style={{
              position:'absolute', left:pos.left, top:pos.top,
              transform:`translate(-50%,-50%) rotate(${pos.rotate+(li-0.5)*5}deg)`,
              opacity: Math.max(0.05, 0.15 - age*0.08),
              zIndex: 12+li, transition:'all 0.3s',
            }}>
              <PlayingCard card={tc.card} size="sm" />
            </div>
          )
        })
      )}

      {/* ── Live played cards ─────────────────────────────────────────────────── */}
      {/* zIndex:30 — always above player chips (zIndex:20) so cards are never    */}
      {/* hidden behind an avatar. Direct state.players lookup prevents any card  */}
      {/* from flashing at the wrong seat if playerMap prop is momentarily stale. */}
      {currentTrick.map(tc => {
        const player = state.players.find(p => p.id === tc.playerId)
        if (!player) return null          // skip if we can't determine the seat
        const seat = S2S[player.position]
        if (seat === undefined) return null
        const pos  = FELT_CARD_POS[seat]
        return (
          <div key={`live-${tc.playerId}`} style={{
            position:'absolute', left:pos.left, top:pos.top,
            transform:`translate(-50%,-50%) rotate(${pos.rotate}deg)`,
            zIndex: 30,                   // above chips (20), rung card (15), history (12-13)
            filter:'drop-shadow(0 6px 18px rgba(0,0,0,0.75))',
            animation:'cardLand 0.28s cubic-bezier(.34,1.56,.64,1)',
          }}>
            <PlayingCard card={tc.card} size="md" />
          </div>
        )
      })}

      {/* ── "Your turn" slot marker ──────────────────────────────────────────── */}
      {isMyTurn && state.phase==='playing' && state.currentTrick.length===0 && (
        <div style={{ position:'absolute', left: FELT_CARD_POS[0].left, top: FELT_CARD_POS[0].top, transform:'translate(-50%,-50%)', zIndex:3, pointerEvents:'none' }}>
          <div style={{ width:46, height:66, borderRadius:8, border:'2px dashed rgba(245,158,11,0.45)', background:'rgba(245,158,11,0.05)', animation:'softPulse 1.6s ease-in-out infinite' }} />
        </div>
      )}

      {/* ── Hidden rung card on table ─────────────────────────────────────────── */}
      {(() => {
        // Show if: card is face-down (hasHiddenRung) OR card has just been revealed (trumpRevealed + scenario A)
        const showRung = state.hasHiddenRung || (state.trumpRevealed && state.scenario === 'A' && rungRevealCard)
        if (!showRung || !state.rungHolderId) return null

        const rungHolder     = state.players.find(p => p.id === state.rungHolderId)
        if (!rungHolder) return null
        const isRungHolder   = userId === state.rungHolderId
        const rungHolderSeat = S2S[rungHolder.position] ?? 0

        return (
          <HiddenRungCard
            isRungHolder={isRungHolder}
            card={isRungHolder ? hiddenRungCard : null}
            revealed={state.trumpRevealed && state.scenario === 'A'}
            revealedCard={rungRevealCard}
            rungHolderSeat={rungHolderSeat}
          />
        )
      })()}

      {/* ── North chip (top-centre) ──────────────────────────────────────────── */}
      {north && (
        <div style={{
          position:'absolute',
          top: isMobile ? '1px' : 'max(0px, calc(7% - 84px))',
          left:'50%', transform:'translateX(-50%)', zIndex:20,
        }}>
          <Chip name={north.displayName??'Bot'} seat="North" team={north.team}
            isLead={state.phase==='playing'&&state.currentTrick.length===0&&state.leadPlayerId===north.id}
            hasPlayed={state.currentTrick.some(t=>t.playerId===north.id)}
            cardCount={state.handCounts?.[north.id]??0}
            face={north.id===userId ? '👤' : '👾'} dir="bottom" compact
            disconnected={north.id!==userId && presence[north.id]==='disconnected'}
            small={isMobile} />
        </div>
      )}

      {/* ── East chip (right-middle) ─────────────────────────────────────────── */}
      {/* On mobile/tablet: compact chip, flush to right edge.                  */}
      {/* On desktop: full chip with card-stack, offset from oval edge.         */}
      {east && (
        <div style={{
          position:'absolute',
          right: isSmall ? '2px' : 'calc(19% - 146px)',
          top:'50%', transform:'translateY(-50%)', zIndex:20,
        }}>
          <Chip name={east.displayName??'Bot'} seat="East" team={east.team}
            isLead={state.phase==='playing'&&state.currentTrick.length===0&&state.leadPlayerId===east.id}
            hasPlayed={state.currentTrick.some(t=>t.playerId===east.id)}
            cardCount={state.handCounts?.[east.id]??0}
            face={east.id===userId ? '👤' : '🤖'} dir="left"
            compact={isSmall}
            disconnected={east.id!==userId && presence[east.id]==='disconnected'}
            small={isMobile} />
        </div>
      )}

      {/* ── West chip (left-middle) ──────────────────────────────────────────── */}
      {west && (
        <div style={{
          position:'absolute',
          left: isSmall ? '2px' : 'calc(19% - 146px)',
          top:'50%', transform:'translateY(-50%)', zIndex:20,
        }}>
          <Chip name={west.displayName??'Bot'} seat="West" team={west.team}
            isLead={state.phase==='playing'&&state.currentTrick.length===0&&state.leadPlayerId===west.id}
            hasPlayed={state.currentTrick.some(t=>t.playerId===west.id)}
            cardCount={state.handCounts?.[west.id]??0}
            face={west.id===userId ? '👤' : '🦾'} dir="right"
            compact={isSmall}
            disconnected={presence[west.id]==='disconnected'}
            small={isMobile} />
        </div>
      )}

      {/* ── South chip (bottom-centre) — shows the server-pos-0 player ──────── */}
      {south && (
        <div style={{
          position:'absolute',
          bottom: isMobile ? '1px' : 'max(0px, calc(7% - 84px))',
          left:'50%', transform:'translateX(-50%)', zIndex:20,
        }}>
          <Chip name={south.id===userId ? (south.displayName??'You') : (south.displayName??'Bot')}
            seat="South" team={south.team}
            isLead={state.phase==='playing'&&state.currentTrick.length===0&&state.leadPlayerId===south.id}
            hasPlayed={state.currentTrick.some(t=>t.playerId===south.id)}
            cardCount={state.handCounts?.[south.id]??0}
            face={south.id===userId ? '👤' : '🧑'} dir="top"
            compact
            disconnected={south.id!==userId && presence[south.id]==='disconnected'}
            small={isMobile} />
        </div>
      )}

      <style>{`
        @keyframes cardLand {
          0%   { transform: translate(-50%,-50%) scale(1.18); opacity:0.6 }
          100% { transform: translate(-50%,-50%) scale(1);    opacity:1   }
        }
        @keyframes pingPulse {
          0%    { transform: scale(1);   opacity:0.9 }
          70%   { transform: scale(1.9); opacity:0   }
          100%  { transform: scale(1.9); opacity:0   }
        }
        @keyframes softPulse {
          0%,100% { opacity:0.4 }
          50%     { opacity:0.9 }
        }
      `}</style>
    </div>
  )
}
