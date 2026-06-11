'use client'
// RungRevealAnnouncement — slides in from the top without blocking the table
// Shows who triggered the reveal, the rung card, and the new trump suit.
// The playing area (cards, table) remains fully visible underneath.

import { useEffect, useState } from 'react'
import { Card } from '@/types/game.types'

const SUIT_SYMBOL: Record<string, string> = {
  hearts:   '♥',
  diamonds: '♦',
  clubs:    '♣',
  spades:   '♠',
}

const SUIT_COLOR_CLASS: Record<string, string> = {
  hearts:   'text-red-400',
  diamonds: 'text-red-400',
  clubs:    'text-white',
  spades:   'text-white',
}

const RANK_DISPLAY: Record<string, string> = {
  A: 'A', K: 'K', Q: 'Q', J: 'J',
  '10': '10', '9': '9', '8': '8', '7': '7',
  '6': '6', '5': '5', '4': '4', '3': '3', '2': '2',
}

interface Props {
  card:        Card
  suit:        string
  triggeredBy: string
  trickNumber: number
  playerNames: Record<string, string>
  onDismiss:   () => void
}

export default function RungRevealAnnouncement({
  card, suit, triggeredBy, trickNumber, playerNames, onDismiss,
}: Props) {
  const [animIn, setAnimIn] = useState(false)

  const symbol      = SUIT_SYMBOL[suit] ?? suit
  const suitColor   = SUIT_COLOR_CLASS[suit] ?? 'text-white'
  const rankLabel   = RANK_DISPLAY[card.rank] ?? card.rank
  const suitLabel   = suit.charAt(0).toUpperCase() + suit.slice(1)
  const triggerName = playerNames[triggeredBy] ?? 'A player'
  const isRed       = suit === 'hearts' || suit === 'diamonds'

  useEffect(() => {
    // Slide in
    const inTimer = setTimeout(() => setAnimIn(true), 30)
    // Auto-dismiss after 4.5 s
    const outTimer = setTimeout(() => {
      setAnimIn(false)
      setTimeout(onDismiss, 350)
    }, 4500)
    return () => { clearTimeout(inTimer); clearTimeout(outTimer) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    /* Anchored to top of screen, pointer-events only on the banner itself */
    <div className="fixed top-0 inset-x-0 z-[300] flex justify-center pointer-events-none">
      <div
        className={`pointer-events-auto mx-4 mt-3 max-w-sm w-full
                    transition-all duration-350 ease-out
                    ${animIn ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}
        onClick={() => { setAnimIn(false); setTimeout(onDismiss, 350) }}
      >
        {/* Banner card */}
        <div className="bg-slate-900/95 backdrop-blur border border-yellow-500/60
                        rounded-2xl shadow-2xl shadow-yellow-500/20 overflow-hidden">

          {/* Coloured top strip */}
          <div className="h-1 bg-gradient-to-r from-yellow-500 via-yellow-300 to-yellow-500" />

          <div className="flex items-center gap-3 px-4 py-3">

            {/* Mini card */}
            <div className={`flex-shrink-0 bg-white rounded-lg w-12 h-16
                             flex flex-col items-center justify-center
                             shadow-lg ring-2 ring-yellow-400/60`}>
              <span className={`text-xl font-black leading-none
                                ${isRed ? 'text-red-500' : 'text-slate-900'}`}>
                {rankLabel}
              </span>
              <span className={`text-lg leading-none ${isRed ? 'text-red-500' : 'text-slate-900'}`}>
                {symbol}
              </span>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider">
                  🃏 Rung Revealed!
                </span>
              </div>

              <div className="text-white font-semibold text-sm leading-tight">
                {rankLabel}&nbsp;of&nbsp;
                <span className={suitColor}>{suitLabel}&nbsp;{symbol}</span>
                &nbsp;is Trump
              </div>

              <div className="text-slate-400 text-xs mt-0.5 truncate">
                {triggerName} couldn&apos;t follow suit · Trick {trickNumber}
              </div>
            </div>

            {/* Trump badge */}
            <div className={`flex-shrink-0 flex flex-col items-center
                             bg-slate-800 border border-slate-600 rounded-xl px-2 py-1`}>
              <span className="text-slate-400 text-[9px] uppercase tracking-wider">Trump</span>
              <span className={`text-2xl font-black ${suitColor}`}>{symbol}</span>
            </div>
          </div>

          {/* Dismiss hint */}
          <div className="text-center text-slate-600 text-[10px] pb-1.5">
            tap to dismiss
          </div>
        </div>
      </div>
    </div>
  )
}
