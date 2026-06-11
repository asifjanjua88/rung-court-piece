export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  suit: Suit
  rank: Rank
}

export const RANK_ORDER: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

export function rankValue(rank: Rank): number {
  return RANK_ORDER.indexOf(rank)
}

export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANK_ORDER) {
      deck.push({ suit, rank })
    }
  }
  return deck
}

export function shuffle(deck: Card[]): Card[] {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

// Deal 13 cards each in 3 batches: 5 + 4 + 4 counter-clockwise
export function dealBatches(deck: Card[], playerCount = 4): Card[][] {
  const hands: Card[][] = Array.from({ length: playerCount }, () => [])
  const batches = [5, 4, 4]
  let idx = 0
  for (const batchSize of batches) {
    for (let p = 0; p < playerCount; p++) {
      for (let c = 0; c < batchSize; c++) {
        hands[p].push(deck[idx++])
      }
    }
  }
  return hands
}
