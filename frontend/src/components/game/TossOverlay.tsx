'use client'
// TossOverlay — toss cards land on the table at each player's position.
// Rendered inside the 3D table container (position:absolute) so cards
// stay within the felt boundaries — calibrated to camera [0,6.2,5.8] fov48.

import { useEffect, useState } from 'react'
import { TossResult } from '@/store/game.store'
import PlayingCard from './PlayingCard'

const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
}

// Fixed absolute mapping — same for ALL viewers (pos 0=South, 1=West, 2=North, 3=East)
const FIXED_S2S: Record<number, number> = { 0: 0, 1: 3, 2: 2, 3: 1 }

// Positions matching FELT_CARD_POS in GameTable2D.tsx (% of container, centred on point)
const SEAT_STYLE: Record<number, React.CSSProperties> = {
  0: { position:'absolute', left:'50%', top:'72%',  transform:'translate(-50%,-50%)' }, // South
  1: { position:'absolute', left:'65%', top:'50%',  transform:'translate(-50%,-50%)' }, // East
  2: { position:'absolute', left:'50%', top:'28%',  transform:'translate(-50%,-50%)' }, // North
  3: { position:'absolute', left:'35%', top:'50%',  transform:'translate(-50%,-50%)' }, // West
}

const SEAT_LABEL: Record<number, string> = { 0: 'South', 1: 'East', 2: 'North', 3: 'West' }

// Fly-in CSS animation class per screen seat (defined in tailwind.config.js)
const FLY_IN: Record<number, string> = {
  0: 'animate-fly-south',
  1: 'animate-fly-east',
  2: 'animate-fly-north',
  3: 'animate-fly-west',
}

interface Props {
  toss:            TossResult
  playerPositions: Record<string, number>
  playerNames:     Record<string, string>
  myId:            string
  onDone:          () => void
}

type Stage = 'dealing' | 'flipping' | 'result'

export default function TossOverlay({ toss, playerPositions, playerNames, myId, onDone }: Props) {
  const [dealtCount,   setDealtCount]   = useState(0)
  const [flippedCount, setFlippedCount] = useState(0)
  const [stage, setStage]               = useState<Stage>('dealing')

  // Use the fixed absolute map — same layout for every viewer
  const SERVER_TO_SCREEN = FIXED_S2S

  const sortedCards = [...toss.tossCards].sort(
    (a, b) => (playerPositions[a.playerId] ?? 0) - (playerPositions[b.playerId] ?? 0)
  )
  const total = sortedCards.length

  useEffect(() => {
    const dealTimers = sortedCards.map((_, i) =>
      setTimeout(() => setDealtCount(i + 1), 300 + i * 350)
    )
    const flipStart  = 300 + total * 350 + 400
    const flipTimers = sortedCards.map((_, i) =>
      setTimeout(() => {
        setFlippedCount(i + 1)
        if (i === total - 1) setStage('flipping')
      }, flipStart + i * 420)
    )
    const t1 = setTimeout(() => setStage('result'),  flipStart + total * 420 + 300)
    const t2 = setTimeout(onDone,                    flipStart + total * 420 + 5000)
    return () => {
      dealTimers.forEach(clearTimeout); flipTimers.forEach(clearTimeout)
      clearTimeout(t1); clearTimeout(t2)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const winnerId = toss.winnerPlayerId
  const isIWon   = winnerId === myId

  return (
    // Absolute so it lives inside the table container — cards stay on the felt
    <div className="absolute inset-0 z-25 pointer-events-none"
         style={{ background: 'rgba(0,0,0,0.52)' }}>

      {/* Toss header */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 animate-slide-up" style={{ zIndex: 10 }}>
        <div style={{
          background: 'rgba(10,8,30,0.92)',
          border: '1px solid rgba(232,192,74,0.55)',
          borderRadius: 999, padding: '6px 24px',
          color: '#e8c04a', fontWeight: 700, fontSize: 14, letterSpacing: 2,
        }}>
          🎲 TOSS
        </div>
      </div>

      {/* Card at each seat */}
      {sortedCards.map((tc, idx) => {
        const serverPos = playerPositions[tc.playerId] ?? 0
        const screen    = SERVER_TO_SCREEN[serverPos] ?? 0
        const isMe      = tc.playerId === myId
        const name      = isMe ? 'You' : (playerNames[tc.playerId] ?? SEAT_LABEL[screen])
        const isWinner  = tc.playerId === winnerId
        const dealt     = idx < dealtCount
        const flipped   = idx < flippedCount

        if (!dealt) return null

        return (
          <div key={tc.playerId} style={{ ...SEAT_STYLE[screen], zIndex: 15 }}>
            <div className="flex flex-col items-center gap-1.5">

              {/* Player badge */}
              <div style={{
                background: isMe ? 'rgba(232,192,74,0.18)' : 'rgba(10,8,30,0.88)',
                border: `1px solid ${isMe ? 'rgba(232,192,74,0.6)' : 'rgba(255,255,255,0.18)'}`,
                borderRadius: 999, padding: '3px 12px',
                color: isMe ? '#e8c04a' : 'rgba(255,255,255,0.80)',
                fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
              }}>
                {isMe ? '👤 You' : `🤖 ${name}`}
              </div>

              {/* Flying card */}
              <div className={`${FLY_IN[screen]} transition-all duration-300 ${
                stage === 'result' && isWinner
                  ? 'ring-4 ring-yellow-400 rounded-lg shadow-[0_0_28px_8px_rgba(245,158,11,0.55)]'
                  : ''
              }`}>
                {flipped
                  ? <PlayingCard card={tc.card} size="md" />
                  : <PlayingCard faceDown size="md" />}
              </div>

              {/* Rank label after flip */}
              {flipped && (
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: tc.card.suit === 'hearts' || tc.card.suit === 'diamonds'
                    ? '#f87171' : 'rgba(255,255,255,0.9)',
                }}>
                  {tc.card.rank} {SUIT_SYMBOL[tc.card.suit]}
                  {stage === 'result' && isWinner && ' 👑'}
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* Result banner — centre-bottom of the table */}
      {stage === 'result' && (
        <div className="pointer-events-auto absolute animate-slide-up"
             style={{ bottom: '12%', left: '50%', transform: 'translateX(-50%)', zIndex: 20 }}>
          <div style={{
            background: isIWon ? 'rgba(5,40,20,0.97)' : 'rgba(10,8,30,0.97)',
            border: `1.5px solid ${isIWon ? '#16a34a' : 'rgba(255,255,255,0.2)'}`,
            borderRadius: 20, padding: '18px 32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            textAlign: 'center', minWidth: 240,
          }}>
            <p style={{
              fontSize: 20, fontWeight: 800,
              color: isIWon ? '#4ade80' : '#fff',
              margin: '0 0 6px',
            }}>
              {isIWon ? '🎉 You won the toss!' : `🏆 Team ${toss.winnerTeam} wins!`}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 12px' }}>
              {isIWon
                ? 'Your team will deal the cards.'
                : `Team ${toss.winnerTeam} deals.`}
            </p>
            <button onClick={onDone} style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.45)', fontSize: 13,
              cursor: 'pointer', textDecoration: 'underline',
            }}>
              Continue →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
