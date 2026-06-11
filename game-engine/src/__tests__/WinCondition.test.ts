import { checkWinScenarioA, checkWinScenarioB } from '../game/WinCondition'

// Helper to build a trickWins array of given length filled with a pattern
const tw = (pattern: string): Array<'A' | 'B'> =>
  pattern.split('').map(c => c.toUpperCase() as 'A' | 'B')

// ─── Scenario A (Hidden Rung) ─────────────────────────────────────────────────

describe('Scenario A — Hidden Rung', () => {

  describe('Rung Holder team wins', () => {

    it('wins with tricks 8+9 (consecutiveA=2, trickNumber=9)', () => {
      const result = checkWinScenarioA({
        consecutiveA: 2, consecutiveB: 0, trickNumber: 9,
        rungHolderTeam: 'A', trumpRevealed: false, rungRevealedOnTrick: null,
        trickWins: tw('BBBBBBBAA'),
      })
      expect(result.winner).toBe('teamA')
      expect(result.reason).toBe('rung_holder_consecutive')
    })

    it('wins with tricks 12+13 (consecutiveA=2, trickNumber=13)', () => {
      const result = checkWinScenarioA({
        consecutiveA: 2, consecutiveB: 0, trickNumber: 13,
        rungHolderTeam: 'A', trumpRevealed: false, rungRevealedOnTrick: null,
        trickWins: tw('BBBBBBBBBBBAA'),
      })
      expect(result.winner).toBe('teamA')
    })

    it('does NOT win when pair ends on trick 8 (consecutiveA=2, trickNumber=8)', () => {
      // Tricks 7+8 consecutive — must NOT count (rung holder needs 8+9 minimum)
      const result = checkWinScenarioA({
        consecutiveA: 2, consecutiveB: 0, trickNumber: 8,
        rungHolderTeam: 'A', trumpRevealed: false, rungRevealedOnTrick: null,
        trickWins: tw('BBBBBBBAA'),
      })
      expect(result.winner).toBeNull()
    })

    it('does NOT win with only 1 consecutive (consecutiveA=1)', () => {
      const result = checkWinScenarioA({
        consecutiveA: 1, consecutiveB: 0, trickNumber: 10,
        rungHolderTeam: 'A', trumpRevealed: false, rungRevealedOnTrick: null,
        trickWins: tw('BBBBBBBBA'),
      })
      expect(result.winner).toBeNull()
    })
  })

  describe('Opponent team wins', () => {

    it('wins when opponent gets 2 consecutive after reveal on trick 5 (pair 5+6)', () => {
      // revealTrick=5 → minSecondTrick = max(4, 6) = 6; trickNumber=6 ≥ 6 ✓
      const result = checkWinScenarioA({
        consecutiveA: 0, consecutiveB: 2, trickNumber: 6,
        rungHolderTeam: 'A', trumpRevealed: true, rungRevealedOnTrick: 5,
        trickWins: tw('AAAAAABB'),
      })
      expect(result.winner).toBe('teamB')
      expect(result.reason).toBe('opponent_consecutive')
    })

    it('does NOT win when pair ends before minSecondTrick (reveal on trick 5, pair 4+5)', () => {
      // minSecondTrick = max(4, 6) = 6; trickNumber=5 < 6 → no win
      const result = checkWinScenarioA({
        consecutiveA: 0, consecutiveB: 2, trickNumber: 5,
        rungHolderTeam: 'A', trumpRevealed: true, rungRevealedOnTrick: 5,
        trickWins: tw('AAAABB'),
      })
      expect(result.winner).toBeNull()
    })

    it('minimum trick 3 rule: reveal on trick 1, opponent needs pair 3+4 minimum', () => {
      // minSecondTrick = max(4, 2) = 4; trickNumber=4 ≥ 4 ✓
      const result = checkWinScenarioA({
        consecutiveA: 0, consecutiveB: 2, trickNumber: 4,
        rungHolderTeam: 'A', trumpRevealed: true, rungRevealedOnTrick: 1,
        trickWins: tw('BABB'),
      })
      expect(result.winner).toBe('teamB')
    })

    it('does NOT win before trick 4 (pair 2+3) even after early reveal', () => {
      // Reveal on trick 1, pair 2+3 → trickNumber=3, minSecondTrick=4 → no win
      const result = checkWinScenarioA({
        consecutiveA: 0, consecutiveB: 2, trickNumber: 3,
        rungHolderTeam: 'A', trumpRevealed: true, rungRevealedOnTrick: 1,
        trickWins: tw('ABB'),
      })
      expect(result.winner).toBeNull()
    })

    it('does NOT win if rung not yet revealed (trumpRevealed=false)', () => {
      const result = checkWinScenarioA({
        consecutiveA: 0, consecutiveB: 2, trickNumber: 8,
        rungHolderTeam: 'A', trumpRevealed: false, rungRevealedOnTrick: null,
        trickWins: tw('AAAAAAAABB'),
      })
      expect(result.winner).toBeNull()
    })

    it('returns ongoing when no condition met mid-game', () => {
      const result = checkWinScenarioA({
        consecutiveA: 1, consecutiveB: 1, trickNumber: 6,
        rungHolderTeam: 'A', trumpRevealed: false, rungRevealedOnTrick: null,
        trickWins: tw('ABABAB'),
      })
      expect(result.winner).toBeNull()
      expect(result.reason).toBe('ongoing')
    })
  })

  describe('Trick 13 fallback', () => {
    // NOTE: Ace Exception (defer win when Ace wins game-ending trick) is handled in
    // GameStateMachine.updateConsecutiveCount — it is NEVER triggered at trick 13
    // because there is no trick 14 to play. So trick 13 always produces a winner
    // regardless of which card (including Ace) wins it.

    it('whoever wins trick 13 wins — rung not revealed', () => {
      // A wins trick 13 (13 chars: ABABABABABABА ends with A)
      const tricks13: Array<'A' | 'B'> = ['A','B','A','B','A','B','A','B','A','B','A','B','A']
      const result = checkWinScenarioA({
        consecutiveA: 1, consecutiveB: 1, trickNumber: 13,
        rungHolderTeam: 'A', trumpRevealed: false, rungRevealedOnTrick: null,
        trickWins: tricks13,
      })
      expect(result.winner).toBe('teamA')
      expect(result.reason).toBe('trick_13_fallback')
    })

    it('whoever wins trick 13 wins — rung was revealed, opponent has higher trump', () => {
      // e.g. hidden card was 10♥, opponent played J♥ → opponent wins trick 13
      const trickWins13 = tw('ABABABABABABAB').slice(0, 13) as Array<'A' | 'B'>
      trickWins13[12] = 'B'
      const result = checkWinScenarioA({
        consecutiveA: 1, consecutiveB: 1, trickNumber: 13,
        rungHolderTeam: 'A', trumpRevealed: true, rungRevealedOnTrick: 8,
        trickWins: trickWins13,
      })
      expect(result.winner).toBe('teamB')
      expect(result.reason).toBe('trick_13_fallback')
    })

    it('rung holder consecutive win takes priority over trick 13 fallback', () => {
      const result = checkWinScenarioA({
        consecutiveA: 2, consecutiveB: 0, trickNumber: 13,
        rungHolderTeam: 'A', trumpRevealed: false, rungRevealedOnTrick: null,
        trickWins: tw('BBBBBBBBBBBAA'),
      })
      expect(result.reason).toBe('rung_holder_consecutive')
    })
  })
})

// ─── Scenario B (Open Rung) ───────────────────────────────────────────────────

describe('Scenario B — Open Rung', () => {

  describe('Non-calling team wins', () => {

    it('wins with pair ending at trick 3 (consecutiveB=2, trickNumber=3)', () => {
      // A is calling; B (non-calling) wins 2 consecutive ending at trick 3 (pair 2+3)
      const result = checkWinScenarioB({
        consecutiveA: 0, consecutiveB: 2, trickNumber: 3, callingTeam: 'A',
      })
      expect(result.winner).toBe('teamB')
      expect(result.reason).toBe('non_calling_consecutive')
    })

    it('does NOT win with pair ending at trick 2 (trickNumber=2)', () => {
      // Pair 1+2 → trickNumber=2 < 3 → no win yet
      const result = checkWinScenarioB({
        consecutiveA: 0, consecutiveB: 2, trickNumber: 2, callingTeam: 'A',
      })
      expect(result.winner).toBeNull()
    })

    it('wins later in the game (consecutiveB=2, trickNumber=8)', () => {
      const result = checkWinScenarioB({
        consecutiveA: 0, consecutiveB: 2, trickNumber: 8, callingTeam: 'A',
      })
      expect(result.winner).toBe('teamB')
    })

    it('does NOT win with only 1 consecutive', () => {
      const result = checkWinScenarioB({
        consecutiveA: 0, consecutiveB: 1, trickNumber: 5, callingTeam: 'A',
      })
      expect(result.winner).toBeNull()
    })
  })

  describe('Calling team survives', () => {

    it('calling team wins at trick 13 when non-calling never got 2 consecutive', () => {
      const result = checkWinScenarioB({
        consecutiveA: 1, consecutiveB: 1, trickNumber: 13, callingTeam: 'A',
      })
      expect(result.winner).toBe('teamA')
      expect(result.reason).toBe('calling_team_survives')
    })

    it('non-calling win takes priority over trick 13 if conditions met simultaneously', () => {
      const result = checkWinScenarioB({
        consecutiveA: 0, consecutiveB: 2, trickNumber: 13, callingTeam: 'A',
      })
      expect(result.winner).toBe('teamB')
      expect(result.reason).toBe('non_calling_consecutive')
    })
  })

  describe('Ongoing', () => {
    it('returns ongoing when no condition met and fewer than 13 tricks', () => {
      const result = checkWinScenarioB({
        consecutiveA: 1, consecutiveB: 1, trickNumber: 6, callingTeam: 'A',
      })
      expect(result.winner).toBeNull()
      expect(result.reason).toBe('ongoing')
    })
  })
})
