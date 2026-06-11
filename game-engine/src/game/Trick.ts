import { Card, Suit, rankValue } from './Deck'

export interface TrickCard {
  playerId: string
  card: Card
}

export function evaluateTrick(trick: TrickCard[], trumpSuit: Suit | null): TrickCard {
  const ledSuit = trick[0].card.suit
  let winner = trick[0]

  for (let i = 1; i < trick.length; i++) {
    const challenger = trick[i]
    const winnerIsTrump = winner.card.suit === trumpSuit
    const challengerIsTrump = challenger.card.suit === trumpSuit

    if (challengerIsTrump && !winnerIsTrump) {
      winner = challenger
    } else if (challengerIsTrump && winnerIsTrump) {
      if (rankValue(challenger.card.rank) > rankValue(winner.card.rank)) {
        winner = challenger
      }
    } else if (!challengerIsTrump && !winnerIsTrump) {
      if (challenger.card.suit === ledSuit && rankValue(challenger.card.rank) > rankValue(winner.card.rank)) {
        winner = challenger
      }
    }
  }

  return winner
}

export function canFollowSuit(hand: Card[], ledSuit: Suit): boolean {
  return hand.some(c => c.suit === ledSuit)
}
