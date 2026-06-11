import { Card } from './Deck'

export interface AceExceptionState {
  active: boolean
  teamThatPlayedAce: 'A' | 'B' | null
  playerThatPlayedAce: string | null   // the specific player who triggered the exception
}

// Call after evaluateTrick when a win condition would be triggered
// Returns true if the Ace Exception blocks the win
export function isAceException(winningCard: Card, wouldEndGame: boolean): boolean {
  return wouldEndGame && winningCard.rank === 'A'
}

// After Ace Exception activates, the same team must win the very next trick
// with a non-Ace card to end the game
export function resolveAceException(
  state: AceExceptionState,
  winningTeam: 'A' | 'B',
  winningCard: Card
): { gameEnds: boolean; resetConsecutive: boolean } {
  if (!state.active || state.teamThatPlayedAce !== winningTeam) {
    return { gameEnds: false, resetConsecutive: true }
  }
  if (winningCard.rank !== 'A') {
    return { gameEnds: true, resetConsecutive: false }
  }
  // Ace again — consecutive resets
  return { gameEnds: false, resetConsecutive: true }
}
