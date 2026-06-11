import { Card, Suit, rankValue } from '../game/Deck'
import { AIContext } from './AIPlayer'

export class EasyBrain {
  chooseCard(ctx: AIContext): Card {
    const { hand, ledSuit } = ctx

    // Follow suit if possible
    const suited = ledSuit ? hand.filter(c => c.suit === ledSuit) : []
    const pool = suited.length > 0 ? suited : hand

    // 20% chance of random suboptimal play
    if (Math.random() < 0.2) {
      return pool[Math.floor(Math.random() * pool.length)]
    }

    // Otherwise play highest card in pool
    return pool.reduce((best, c) => rankValue(c.rank) > rankValue(best.rank) ? c : best)
  }

  chooseHiddenRung(hand: Card[]): Card {
    // Pick randomly from first 5 cards
    return hand[Math.floor(Math.random() * hand.length)]
  }

  shouldCallColor(_hand: Card[]): Suit | null {
    // Easy AI never calls color
    return null
  }
}
