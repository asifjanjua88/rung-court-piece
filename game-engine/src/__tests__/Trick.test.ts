import { evaluateTrick, canFollowSuit, TrickCard } from '../game/Trick'
import { Card, Suit, Rank } from '../game/Deck'

const c = (suit: Suit, rank: Rank): Card => ({ suit, rank })
const tc = (pid: string, suit: Suit, rank: Rank): TrickCard => ({
  playerId: pid,
  card: c(suit, rank),
})

describe('evaluateTrick', () => {

  describe('No trump', () => {
    it('led-suit highest wins when no trump', () => {
      const trick = [
        tc('P1', 'hearts', 'K'),
        tc('P2', 'hearts', 'A'),
        tc('P3', 'spades', 'A'),
        tc('P4', 'hearts', '9'),
      ]
      expect(evaluateTrick(trick, null).playerId).toBe('P2')
    })

    it('first player wins if they played highest of led suit', () => {
      const trick = [tc('P1','hearts','10'), tc('P2','hearts','5'), tc('P3','hearts','7')]
      expect(evaluateTrick(trick, null).playerId).toBe('P1')
    })

    it('off-suit never beats led suit', () => {
      const trick = [tc('P1','hearts','5'), tc('P2','spades','A')]
      expect(evaluateTrick(trick, null).playerId).toBe('P1')
    })
  })

  describe('With trump', () => {
    it('single trump beats all non-trump', () => {
      const trick = [
        tc('P1', 'hearts', 'A'),
        tc('P2', 'hearts', 'K'),
        tc('P3', 'spades', '2'),
        tc('P4', 'hearts', 'Q'),
      ]
      expect(evaluateTrick(trick, 'spades').playerId).toBe('P3')
    })

    it('higher trump beats lower trump', () => {
      const trick = [
        tc('P1', 'spades', '5'),
        tc('P2', 'spades', 'A'),
        tc('P3', 'spades', 'K'),
      ]
      expect(evaluateTrick(trick, 'spades').playerId).toBe('P2')
    })

    it('first trump played beats second if lower rank', () => {
      const trick = [
        tc('P1', 'hearts', 'A'),
        tc('P2', 'spades', 'K'),
        tc('P3', 'spades', '5'),
      ]
      expect(evaluateTrick(trick, 'spades').playerId).toBe('P2')
    })

    it('led suit vs off-suit no trump: led suit wins', () => {
      const trick = [
        tc('P1', 'hearts', '5'),
        tc('P2', 'clubs',  'A'),
      ]
      expect(evaluateTrick(trick, 'spades').playerId).toBe('P1')
    })
  })

  describe('4-player full tricks', () => {
    it('works correctly across all 4 positions', () => {
      const trick = [
        tc('N', 'diamonds', '7'),
        tc('E', 'diamonds', 'J'),
        tc('S', 'clubs',    'A'),
        tc('W', 'clubs',    '3'),
      ]
      expect(evaluateTrick(trick, 'clubs').playerId).toBe('S')
    })
  })
})

describe('canFollowSuit', () => {
  it('returns true when hand has the led suit', () => {
    const hand: Card[] = [c('hearts','5'), c('spades','K')]
    expect(canFollowSuit(hand, 'hearts')).toBe(true)
  })

  it('returns false when hand has no led suit cards', () => {
    const hand: Card[] = [c('spades','A'), c('clubs','2')]
    expect(canFollowSuit(hand, 'hearts')).toBe(false)
  })

  it('returns false for empty hand', () => {
    expect(canFollowSuit([], 'hearts')).toBe(false)
  })
})
