import { Card, Suit, SUITS, rankValue } from '../game/Deck'
import { AIContext } from './AIPlayer'

export class MediumBrain {
  chooseCard(ctx: AIContext): Card {
    const { hand, ledSuit, trumpSuit, currentTrick } = ctx

    const suited = ledSuit ? hand.filter(c => c.suit === ledSuit) : []

    if (suited.length > 0) {
      // Follow suit — play lowest card that wins, or lowest if can't win
      const currentHighest = this.trickHighestRank(currentTrick, ledSuit)
      const winners = suited.filter(c => rankValue(c.rank) > currentHighest)
      const pool = winners.length > 0 ? winners : suited
      return pool.reduce((low, c) => rankValue(c.rank) < rankValue(low.rank) ? c : low)
    }

    // Can't follow suit — play lowest trump if trick isn't already won by trump
    if (trumpSuit) {
      const trumpCards = hand.filter(c => c.suit === trumpSuit)
      const trickAlreadyHasTrump = currentTrick.some(tc => tc.card.suit === trumpSuit)
      if (trumpCards.length > 0 && !trickAlreadyHasTrump) {
        return trumpCards.reduce((low, c) => rankValue(c.rank) < rankValue(low.rank) ? c : low)
      }
    }

    // Discard lowest card
    return hand.reduce((low, c) => rankValue(c.rank) < rankValue(low.rank) ? c : low)
  }

  private trickHighestRank(trick: AIContext['currentTrick'], suit: Suit | null): number {
    if (!suit) return -1
    return trick
      .filter(tc => tc.card.suit === suit)
      .reduce((max, tc) => Math.max(max, rankValue(tc.card.rank)), -1)
  }

  chooseHiddenRung(hand: Card[]): Card {
    // Pick mid-value card of the strongest suit
    const best = this.bestSuit(hand)
    const suited = hand.filter(c => c.suit === best).sort((a, b) => rankValue(a.rank) - rankValue(b.rank))
    return suited[Math.floor(suited.length / 2)]
  }

  shouldCallColor(hand: Card[]): Suit | null {
    // With 13 cards dealt, having >=4 of any suit is almost guaranteed (pigeonhole).
    // Raise threshold to 8 so that Scenario B only happens with a truly dominant suit.
    for (const suit of SUITS) {
      if (hand.filter(c => c.suit === suit).length >= 8) return suit
    }
    return null
  }

  private bestSuit(hand: Card[]): Suit {
    let best: Suit = SUITS[0]
    let bestScore = -1
    for (const suit of SUITS) {
      const score = hand.filter(c => c.suit === suit).reduce((s, c) => s + rankValue(c.rank), 0)
      if (score > bestScore) { bestScore = score; best = suit }
    }
    return best
  }
}
