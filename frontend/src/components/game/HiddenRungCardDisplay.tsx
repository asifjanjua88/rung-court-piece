'use client'
import { useState } from 'react'
import { Card } from '@/types/game.types'
import PlayingCard from './PlayingCard'

const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
}
const SUIT_COLOR: Record<string, string> = {
  spades: 'text-slate-900', hearts: 'text-red-600',
  diamonds: 'text-red-600', clubs: 'text-slate-900',
}

interface Props {
  isRungHolder: boolean
  /** The actual card — only defined on rung holder's client */
  peekCard: Card | null
}

export default function HiddenRungCardDisplay({ isRungHolder, peekCard }: Props) {
  const [peeking, setPeeking] = useState(false)

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Label */}
      <span className="text-blue-300 text-xs font-semibold tracking-wide uppercase">
        🤫 Hidden Rung
      </span>

      {/* Face-down card with glowing blue outline */}
      <div className="relative group animate-hidden-rung rounded-lg">
        <PlayingCard faceDown size="md" />

        {/* Rung holder peek button — appears on hover */}
        {isRungHolder && peekCard && (
          <button
            onMouseEnter={() => setPeeking(true)}
            onMouseLeave={() => setPeeking(false)}
            onClick={() => setPeeking(v => !v)}
            className="absolute inset-0 flex items-center justify-center
                       bg-black/0 hover:bg-black/50 rounded-lg
                       transition-all duration-200 cursor-pointer group">
            <span className="text-white/0 group-hover:text-white/90 text-xs font-bold
                             transition-all duration-200 text-center leading-tight">
              👁<br/>Peek
            </span>
          </button>
        )}
      </div>

      {/* Peek popup — fixed overlay so it's never clipped; only renders in rung holder's browser */}
      {peeking && peekCard && (
        <div className="fixed z-[200] inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 animate-bounce-in
                          bg-slate-900/95 border-2 border-gold/70 rounded-2xl p-6 shadow-2xl">
            <p className="text-gold text-sm font-bold">🤫 Your hidden rung card</p>
            <PlayingCard card={peekCard} size="lg" />
            <p className={`text-lg font-bold ${SUIT_COLOR[peekCard.suit]
              .replace('text-slate-900', 'text-slate-200')}`}>
              {peekCard.rank} {SUIT_SYMBOL[peekCard.suit]}{' '}
              <span className="capitalize">{peekCard.suit}</span>
            </p>
            <p className="text-slate-500 text-xs">Only visible to you</p>
          </div>
        </div>
      )}

      {/* Hint for rung holder */}
      {isRungHolder && (
        <span className="text-blue-400/60 text-xs">hover to peek</span>
      )}
    </div>
  )
}
