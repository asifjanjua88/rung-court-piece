'use client'
import { useState } from 'react'
import { Card } from '@/types/game.types'
import { useGameStore } from '@/store/game.store'
import PlayingCard from './PlayingCard'

interface Props {
  hand: Card[]
  onSelect: (card: Card) => void
}

export default function HiddenRungPicker({ hand, onSelect }: Props) {
  const [selected, setSelected] = useState<Card | null>(null)
  const { setHiddenRungCard } = useGameStore()

  const handleConfirm = () => {
    if (!selected) return
    setHiddenRungCard(selected)   // save locally so rung holder can peek later
    onSelect(selected)
  }

  const isSelected = (c: Card) =>
    selected?.suit === c.suit && selected?.rank === c.rank

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
         style={{ alignItems: 'flex-end', padding: 0 }}>
      <div className="bg-slate-800 rounded-t-2xl border border-gold/40 w-full shadow-2xl animate-bounce-in"
           style={{ maxHeight: '85dvh', overflowY: 'auto', padding: '20px 16px 24px' }}>
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🤫</div>
          <h2 className="text-xl font-bold text-slate-100">Select Your Hidden Rung Card</h2>
          <p className="text-slate-400 text-sm mt-1">
            Pick one card to place face-down as the hidden trump (Rung).
            All players will see a <span className="text-blue-400 font-semibold">face-down card</span> on
            the table but only you know what it is.
            The card <span className="text-gold font-semibold">returns to your hand</span> when the
            trump is revealed.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {hand.map((card, i) => (
            <div key={i} className="animate-deal-in" style={{ animationDelay: `${i * 40}ms` }}>
              <PlayingCard
                card={card}
                selected={isSelected(card)}
                onClick={() => setSelected(isSelected(card) ? null : card)}
                size="sm"
              />
            </div>
          ))}
        </div>

        {selected && (
          <div className="text-center mb-4 text-sm text-slate-400">
            Selected: <span className="text-gold font-bold">
              {selected.rank} of {selected.suit}
            </span> — this becomes your hidden trump
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!selected}
          className="btn-primary py-3">
          🤫 Place Face-Down on Table
        </button>
      </div>
    </div>
  )
}
