import { buildDeck, shuffle, dealBatches, rankValue, Rank } from '../game/Deck'

describe('Deck', () => {

  describe('buildDeck', () => {
    it('produces exactly 52 cards', () => {
      expect(buildDeck()).toHaveLength(52)
    })

    it('contains 4 suits × 13 ranks', () => {
      const deck = buildDeck()
      const suits = new Set(deck.map(c => c.suit))
      const ranks = new Set(deck.map(c => c.rank))
      expect(suits.size).toBe(4)
      expect(ranks.size).toBe(13)
    })

    it('has no duplicates', () => {
      const deck = buildDeck()
      const keys = deck.map(c => `${c.suit}:${c.rank}`)
      expect(new Set(keys).size).toBe(52)
    })
  })

  describe('shuffle', () => {
    it('returns 52 cards', () => {
      expect(shuffle(buildDeck())).toHaveLength(52)
    })

    it('does not lose any cards (same multiset)', () => {
      const deck = buildDeck()
      const before = deck.map(c => `${c.suit}:${c.rank}`).sort()
      const shuffled = shuffle([...deck])
      const after = shuffled.map(c => `${c.suit}:${c.rank}`).sort()
      expect(after).toEqual(before)
    })

    it('produces a different order at least occasionally (runs 5 times)', () => {
      const deck = buildDeck()
      const original = deck.map(c => `${c.suit}:${c.rank}`).join()
      const differs = Array.from({ length: 5 }, () =>
        shuffle([...deck]).map(c => `${c.suit}:${c.rank}`).join() !== original
      )
      expect(differs.some(Boolean)).toBe(true)
    })
  })

  describe('dealBatches (5+4+4 counter-clockwise)', () => {
    // dealBatches returns Card[][] — hands[0..3], each accumulates all 3 batches
    it('returns 4 hands', () => {
      const hands = dealBatches(buildDeck())
      expect(hands).toHaveLength(4)
    })

    it('each player gets 13 cards total (5+4+4)', () => {
      const hands = dealBatches(buildDeck())
      hands.forEach(hand => expect(hand).toHaveLength(13))
    })

    it('distributes all 52 cards with no duplicates', () => {
      const hands = dealBatches(buildDeck())
      const all = hands.flat()
      expect(all).toHaveLength(52)
      const keys = all.map(c => `${c.suit}:${c.rank}`)
      expect(new Set(keys).size).toBe(52)
    })
  })

  describe('rankValue', () => {
    it('Ace is highest', () => expect(rankValue('A')).toBeGreaterThan(rankValue('K')))
    it('King > Queen',  () => expect(rankValue('K')).toBeGreaterThan(rankValue('Q')))
    it('2 is lowest',   () => expect(rankValue('2')).toBe(0))
    it('ranks are strictly ordered', () => {
      const ranks: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
      const values = ranks.map(rankValue)
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1])
      }
    })
  })
})
