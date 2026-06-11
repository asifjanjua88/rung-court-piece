import { isAceException, resolveAceException, AceExceptionState } from '../game/AceException'
import { Card } from '../game/Deck'

const card = (rank: string): Card => ({ suit: 'hearts', rank: rank as Card['rank'] })

describe('isAceException', () => {

  it('blocks win when winning card is Ace and game would end', () => {
    expect(isAceException(card('A'), true)).toBe(true)
  })

  it('does NOT block when winning card is not Ace', () => {
    expect(isAceException(card('K'), true)).toBe(false)
  })

  it('does NOT block when game would not end regardless of card', () => {
    expect(isAceException(card('A'), false)).toBe(false)
  })

  it('false for non-Ace non-game-ending', () => {
    expect(isAceException(card('Q'), false)).toBe(false)
  })
})

describe('resolveAceException', () => {

  const active = (team: 'A' | 'B'): AceExceptionState => ({
    active: true,
    teamThatPlayedAce: team,
    playerThatPlayedAce: 'player1',
  })

  it('game ends when same team wins next trick with non-Ace', () => {
    const result = resolveAceException(active('A'), 'A', card('K'))
    expect(result.gameEnds).toBe(true)
    expect(result.resetConsecutive).toBe(false)
  })

  it('does NOT end game when different team wins the next trick', () => {
    const result = resolveAceException(active('A'), 'B', card('K'))
    expect(result.gameEnds).toBe(false)
    expect(result.resetConsecutive).toBe(true)
  })

  it('consecutive resets when same team plays Ace again', () => {
    const result = resolveAceException(active('A'), 'A', card('A'))
    expect(result.gameEnds).toBe(false)
    expect(result.resetConsecutive).toBe(true)
  })

  it('when state is not active, does not end game', () => {
    const state: AceExceptionState = { active: false, teamThatPlayedAce: null, playerThatPlayedAce: null }
    const result = resolveAceException(state, 'A', card('K'))
    expect(result.gameEnds).toBe(false)
    expect(result.resetConsecutive).toBe(true)
  })
})
