import { Card, Suit, SUITS, RANK_ORDER, rankValue } from '../game/Deck'
import { AIContext } from './AIPlayer'

export class HardBrain {
  chooseCard(ctx: AIContext): Card {
    const { hand, ledSuit, trumpSuit, currentTrick, playedCards, partnerPlayedCard } = ctx

    const suited = ledSuit ? hand.filter(c => c.suit === ledSuit) : []

    if (suited.length > 0) {
      // Partner already winning? Play lowest to conserve
      if (partnerPlayedCard && this.isCurrentWinner(partnerPlayedCard, currentTrick, trumpSuit)) {
        return suited.reduce((low, c) => rankValue(c.rank) < rankValue(low.rank) ? c : low)
      }
      // Try to win with minimum card
      const currentBest = this.trickBestCard(currentTrick, ledSuit, trumpSuit)
      const winners = suited.filter(c => rankValue(c.rank) > rankValue(currentBest.rank))
      const pool = winners.length > 0 ? winners : suited
      return pool.reduce((low, c) => rankValue(c.rank) < rankValue(low.rank) ? c : low)
    }

    // Can't follow suit — play minimum trump needed to win, using card memory
    if (trumpSuit) {
      const trumpCards = hand.filter(c => c.suit === trumpSuit)
      const highestTrumpInTrick = currentTrick
        .filter(tc => tc.card.suit === trumpSuit)
        .reduce((max, tc) => rankValue(tc.card.rank) > rankValue(max.rank) ? tc.card : max, { rank: '2', suit: trumpSuit } as Card)

      const winningTrumps = trumpCards.filter(c => rankValue(c.rank) > rankValue(highestTrumpInTrick.rank))
      if (winningTrumps.length > 0) {
        return winningTrumps.reduce((low, c) => rankValue(c.rank) < rankValue(low.rank) ? c : low)
      }
    }

    // Discard card least likely to be needed — lowest of most common suit held
    const knownRemaining = this.getRemainingCards(hand, playedCards)
    return this.safestDiscard(hand, knownRemaining, trumpSuit)
  }

  private isCurrentWinner(card: AIContext['partnerPlayedCard'], trick: AIContext['currentTrick'], trump: Suit | null): boolean {
    if (!card) return false
    for (const tc of trick) {
      if (tc.playerId === card.playerId) continue
      if (trump && tc.card.suit === trump && card.card.suit !== trump) return false
      if (tc.card.suit === card.card.suit && rankValue(tc.card.rank) > rankValue(card.card.rank)) return false
    }
    return true
  }

  private trickBestCard(trick: AIContext['currentTrick'], ledSuit: Suit | null, trump: Suit | null): Card {
    return trick.reduce((best, tc) => {
      const isTrump = tc.card.suit === trump
      const bestIsTrump = best.suit === trump
      if (isTrump && !bestIsTrump) return tc.card
      if (isTrump && bestIsTrump && rankValue(tc.card.rank) > rankValue(best.rank)) return tc.card
      if (!isTrump && !bestIsTrump && tc.card.suit === ledSuit && rankValue(tc.card.rank) > rankValue(best.rank)) return tc.card
      return best
    }, trick[0]?.card ?? { suit: 'spades', rank: '2' } as Card)
  }

  private getRemainingCards(hand: Card[], played: Card[]): Card[] {
    const playedSet = new Set(played.map(c => `${c.suit}-${c.rank}`))
    const handSet = new Set(hand.map(c => `${c.suit}-${c.rank}`))
    return SUITS.flatMap(suit =>
      RANK_ORDER.map(rank => ({ suit, rank } as Card))
    ).filter(c => !playedSet.has(`${c.suit}-${c.rank}`) && !handSet.has(`${c.suit}-${c.rank}`))
  }

  private safestDiscard(hand: Card[], _remaining: Card[], trump: Suit | null): Card {
    const nonTrump = hand.filter(c => c.suit !== trump)
    const pool = nonTrump.length > 0 ? nonTrump : hand
    return pool.reduce((low, c) => rankValue(c.rank) < rankValue(low.rank) ? c : low)
  }

  chooseHiddenRung(hand: Card[]): Card {
    // Best suit = highest combined rank score
    const best = this.bestSuit(hand)
    const suited = hand.filter(c => c.suit === best)
    // Sacrifice strongest card of best suit as Hidden Rung
    return suited.reduce((max, c) => rankValue(c.rank) > rankValue(max.rank) ? c : max)
  }

  shouldCallColor(hand: Card[]): Suit | null {
    // Call if a suit has 4+ cards AND combined strength is high
    let bestSuit: Suit | null = null
    let bestScore = 0
    for (const suit of SUITS) {
      const cards = hand.filter(c => c.suit === suit)
      if (cards.length >= 7) {
        const score = cards.reduce((s, c) => s + rankValue(c.rank), 0)
        if (score > bestScore) { bestScore = score; bestSuit = suit }
      }
    }
    return bestSuit
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
