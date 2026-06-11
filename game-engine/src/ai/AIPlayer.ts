import { Card, Suit } from '../game/Deck'
import { TrickCard } from '../game/Trick'
import { EasyBrain } from './EasyBrain'
import { MediumBrain } from './MediumBrain'
import { HardBrain } from './HardBrain'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface AIContext {
  hand: Card[]
  currentTrick: TrickCard[]
  ledSuit: Suit | null
  trumpSuit: Suit | null
  trickNumber: number
  playedCards: Card[]          // all cards played so far (for Hard AI memory)
  consecutiveA: number
  consecutiveB: number
  scenario: 'A' | 'B' | null
  myTeam: 'A' | 'B'
  partnerPlayedCard: TrickCard | null
}

export function chooseCard(difficulty: Difficulty, ctx: AIContext): Card {
  switch (difficulty) {
    case 'easy':   return new EasyBrain().chooseCard(ctx)
    case 'medium': return new MediumBrain().chooseCard(ctx)
    case 'hard':   return new HardBrain().chooseCard(ctx)
  }
}

export function chooseHiddenRung(difficulty: Difficulty, hand: Card[]): Card {
  switch (difficulty) {
    case 'easy':   return new EasyBrain().chooseHiddenRung(hand)
    case 'medium': return new MediumBrain().chooseHiddenRung(hand)
    case 'hard':   return new HardBrain().chooseHiddenRung(hand)
  }
}

export function shouldCallColor(difficulty: Difficulty, hand: Card[]): Suit | null {
  switch (difficulty) {
    case 'easy':   return new EasyBrain().shouldCallColor(hand)
    case 'medium': return new MediumBrain().shouldCallColor(hand)
    case 'hard':   return new HardBrain().shouldCallColor(hand)
  }
}
