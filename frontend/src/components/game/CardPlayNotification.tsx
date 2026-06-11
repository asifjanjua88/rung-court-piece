'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/types/game.types'
import PlayingCard from './PlayingCard'

interface Props {
  card: Card
  playerName: string
  /** Screen seat: 0=South(me), 1=East(right), 2=North(top), 3=West(left) */
  screenPos: number
  isMe: boolean
}

// The notification floats AT the player's seat and fades out
// The card uses a fly-in animation from the player's direction toward centre
const FLY_ANIM: Record<number, string> = {
  0: 'animate-fly-south',
  1: 'animate-fly-east',
  2: 'animate-fly-north',
  3: 'animate-fly-west',
}

// Where on screen the notification appears
const SEAT_STYLE: Record<number, string> = {
  0: 'bottom-40 left-1/2 -translate-x-1/2',   // South — above my hand
  1: 'right-28 top-1/2 -translate-y-1/2',      // East
  2: 'top-32 left-1/2 -translate-x-1/2',       // North
  3: 'left-28 top-1/2 -translate-y-1/2',       // West
}

export default function CardPlayNotification({ card, playerName, screenPos, isMe }: Props) {
  const [fade, setFade] = useState(false)

  useEffect(() => {
    // Start fading after 1.2 s so it clears before the next card is played
    const t = setTimeout(() => setFade(true), 1200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`absolute ${SEAT_STYLE[screenPos]} z-20 pointer-events-none
                     flex flex-col items-center gap-2
                     transition-opacity duration-500 ${fade ? 'opacity-0' : 'opacity-100'}`}>

      {/* "Who played" badge */}
      <div className={`text-xs font-bold px-3 py-1 rounded-full border shadow-lg
                       ${isMe
                         ? 'bg-gold/30 border-gold text-gold'
                         : 'bg-slate-900/90 border-white/30 text-white'}`}>
        {isMe ? '👤 You played' : `🤖 ${playerName} played`}
      </div>

      {/* The card with direction fly animation */}
      <div className={`${FLY_ANIM[screenPos]} drop-shadow-2xl`}>
        <PlayingCard card={card} size="lg" />
      </div>
    </div>
  )
}
