import { EasyBrain } from '../ai/EasyBrain'
import { MediumBrain } from '../ai/MediumBrain'
import { HardBrain } from '../ai/HardBrain'
import { AIContext } from '../ai/AIPlayer'
import { Card, Suit, Rank } from '../game/Deck'

// ── Helpers ──────────────────────────────────────────────────────────────────

const c = (suit: Suit, rank: Rank): Card => ({ suit, rank })

const baseCtx = (): AIContext => ({
  hand: [],
  currentTrick: [],
  ledSuit: null,
  trumpSuit: null,
  trickNumber: 1,
  playedCards: [],
  consecutiveA: 0,
  consecutiveB: 0,
  scenario: 'A',
  myTeam: 'A',
  partnerPlayedCard: null,
})

// ─── EasyBrain ────────────────────────────────────────────────────────────────

describe('EasyBrain', () => {
  const brain = new EasyBrain()

  describe('chooseCard', () => {
    it('always returns a card from the hand', () => {
      const hand = [c('hearts','5'), c('spades','K'), c('diamonds','2')]
      const result = brain.chooseCard({ ...baseCtx(), hand })
      expect(hand).toContainEqual(result)
    })

    it('follows led suit when possible', () => {
      const hand = [c('hearts','5'), c('spades','K')]
      const results = Array.from({ length: 50 }, () =>
        brain.chooseCard({ ...baseCtx(), hand, ledSuit: 'hearts' })
      )
      expect(results.every(r => r.suit === 'hearts')).toBe(true)
    })

    it('plays from full hand when no led suit', () => {
      const hand = [c('clubs','3'), c('diamonds','7')]
      const result = brain.chooseCard({ ...baseCtx(), hand })
      expect(hand).toContainEqual(result)
    })
  })

  describe('chooseHiddenRung', () => {
    it('returns one of the hand cards', () => {
      const hand = [c('hearts','A'), c('spades','Q'), c('clubs','5')]
      expect(hand).toContainEqual(brain.chooseHiddenRung(hand))
    })
  })

  describe('shouldCallColor', () => {
    it('always returns null (Easy never calls)', () => {
      const hand = [c('hearts','A'), c('hearts','K'), c('hearts','Q'), c('hearts','J'), c('hearts','10')]
      expect(brain.shouldCallColor(hand)).toBeNull()
    })
  })
})

// ─── MediumBrain ─────────────────────────────────────────────────────────────

describe('MediumBrain', () => {
  const brain = new MediumBrain()

  describe('chooseCard', () => {
    it('follows led suit', () => {
      const hand = [c('hearts','5'), c('spades','K')]
      const result = brain.chooseCard({ ...baseCtx(), hand, ledSuit: 'hearts' })
      expect(result.suit).toBe('hearts')
    })

    it('plays lowest card that wins the trick when following suit', () => {
      const hand = [c('hearts','5'), c('hearts','J')]
      const ctx: AIContext = {
        ...baseCtx(),
        hand,
        ledSuit: 'hearts',
        currentTrick: [{ playerId: 'other', card: c('hearts','7') }],
      }
      const result = brain.chooseCard(ctx)
      expect(result).toEqual(c('hearts','J'))
    })

    it('plays lowest trump when cannot follow suit and trick has no trump', () => {
      const hand = [c('spades','3'), c('spades','J'), c('clubs','2')]
      const ctx: AIContext = {
        ...baseCtx(),
        hand,
        ledSuit: 'hearts',
        trumpSuit: 'spades',
        currentTrick: [{ playerId: 'other', card: c('hearts','A') }],
      }
      const result = brain.chooseCard(ctx)
      expect(result).toEqual(c('spades','3'))
    })

    it('discards lowest card when cannot follow suit and no trump available', () => {
      const hand = [c('clubs','2'), c('diamonds','K')]
      const ctx: AIContext = {
        ...baseCtx(),
        hand,
        ledSuit: 'hearts',
        trumpSuit: 'spades',
        currentTrick: [{ playerId: 'other', card: c('hearts','A') }],
      }
      const result = brain.chooseCard(ctx)
      expect(result).toEqual(c('clubs','2'))
    })
  })

  describe('chooseHiddenRung', () => {
    it('returns a card from the best suit', () => {
      const hand = [
        c('spades','2'), c('spades','3'),
        c('hearts','A'), c('hearts','K'), c('hearts','Q'),
      ]
      const result = brain.chooseHiddenRung(hand)
      expect(result.suit).toBe('hearts')
    })
  })

  describe('shouldCallColor', () => {
    it('calls color when holding 4+ cards of a suit', () => {
      const hand = [c('hearts','A'), c('hearts','K'), c('hearts','Q'), c('hearts','J')]
      expect(brain.shouldCallColor(hand)).toBe('hearts')
    })

    it('returns null when no suit has 4+ cards', () => {
      const hand = [c('hearts','A'), c('spades','K'), c('diamonds','Q'), c('clubs','J')]
      expect(brain.shouldCallColor(hand)).toBeNull()
    })
  })
})

// ─── HardBrain ────────────────────────────────────────────────────────────────

describe('HardBrain', () => {
  const brain = new HardBrain()

  describe('chooseCard', () => {
    it('conserves when partner is already winning', () => {
      const hand = [c('hearts','A'), c('hearts','3')]
      const partnerCard = { playerId: 'partner', card: c('hearts','K') }
      const ctx: AIContext = {
        ...baseCtx(),
        hand,
        ledSuit: 'hearts',
        currentTrick: [
          { playerId: 'enemy', card: c('hearts','5') },
          partnerCard,
        ],
        partnerPlayedCard: partnerCard,
      }
      const result = brain.chooseCard(ctx)
      expect(result).toEqual(c('hearts','3'))
    })

    it('plays minimum trump to win when cannot follow suit', () => {
      const hand = [c('spades','4'), c('spades','9'), c('clubs','2')]
      const ctx: AIContext = {
        ...baseCtx(),
        hand,
        ledSuit: 'hearts',
        trumpSuit: 'spades',
        currentTrick: [{ playerId: 'other', card: c('spades','3') }],
      }
      const result = brain.chooseCard(ctx)
      expect(result).toEqual(c('spades','4'))
    })

    it('discards lowest non-trump when cannot win', () => {
      const hand = [c('clubs','2'), c('clubs','5'), c('spades','4')]
      const ctx: AIContext = {
        ...baseCtx(),
        hand,
        ledSuit: 'hearts',
        trumpSuit: 'spades',
        currentTrick: [{ playerId: 'other', card: c('spades','A') }],
      }
      const result = brain.chooseCard(ctx)
      expect(result).toEqual(c('clubs','2'))
    })
  })

  describe('chooseHiddenRung — strongest of best suit', () => {
    it('picks the HIGHEST rank card of the best suit', () => {
      const hand = [
        c('spades','2'), c('spades','3'),
        c('hearts','K'), c('hearts','Q'), c('hearts','J'),
      ]
      const result = brain.chooseHiddenRung(hand)
      expect(result).toEqual(c('hearts','K'))
    })

    it('picks from the suit with highest combined score', () => {
      const hand = [
        c('clubs','A'), c('clubs','2'),
        c('hearts','K'), c('hearts','Q'), c('hearts','J'),
      ]
      const result = brain.chooseHiddenRung(hand)
      expect(result).toEqual(c('hearts','K'))
    })
  })

  describe('shouldCallColor', () => {
    it('calls when 4+ cards of a suit with high strength', () => {
      const hand = [c('hearts','A'), c('hearts','K'), c('hearts','Q'), c('hearts','J')]
      expect(brain.shouldCallColor(hand)).toBe('hearts')
    })

    it('returns null when no suit has 4+ cards', () => {
      const hand = [c('hearts','A'), c('spades','K'), c('diamonds','Q'), c('clubs','J')]
      expect(brain.shouldCallColor(hand)).toBeNull()
    })

    it('picks the stronger of two qualifying suits', () => {
      const hand = [
        c('hearts','2'), c('hearts','3'), c('hearts','4'), c('hearts','5'),
        c('spades','A'), c('spades','K'), c('spades','Q'), c('spades','J'),
      ]
      expect(brain.shouldCallColor(hand)).toBe('spades')
    })
  })
})
