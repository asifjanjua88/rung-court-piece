// ── Win state ─────────────────────────────────────────────────────────────────
export interface WinState {
  winner: 'teamA' | 'teamB' | null
  reason: string
}

// ── Scenario A: Hidden Rung ───────────────────────────────────────────────────
//
// Uses consecutive COUNTERS (not the raw trickWins array) so that Ace Exception
// resets are honoured. Raw array checks would re-detect old pairs after a reset.
//
// Rung Holder wins : ≥2 consecutive, pair ending on trick ≥9 (starts at trick 8+)
// Opponent  wins   : ≥2 consecutive, pair ending on trick ≥ max(4, revealTrick+1)
//                    i.e. pair starts at trick ≥ max(3, revealTrick)
// Fallback         : winner of trick 13
export function checkWinScenarioA(params: {
  consecutiveA:       number
  consecutiveB:       number
  trickNumber:        number          // 1-indexed, trick that just completed
  rungHolderTeam:    'A' | 'B'
  trumpRevealed:      boolean
  rungRevealedOnTrick: number | null  // 1-indexed trick number of reveal
  trickWins:          Array<'A' | 'B' | string>  // only for trick-13 fallback
}): WinState {
  const {
    consecutiveA, consecutiveB, trickNumber,
    rungHolderTeam, trumpRevealed, rungRevealedOnTrick, trickWins,
  } = params

  const opponentTeam = rungHolderTeam === 'A' ? 'B' : 'A'
  const rhConsec     = rungHolderTeam === 'A' ? consecutiveA : consecutiveB
  const oppConsec    = opponentTeam   === 'A' ? consecutiveA : consecutiveB

  // Rung Holder: pair ends at trick ≥9 (8+9, 9+10, …)
  if (rhConsec >= 2 && trickNumber >= 9) {
    return { winner: `team${rungHolderTeam}` as 'teamA' | 'teamB', reason: 'rung_holder_consecutive' }
  }

  // Opponent: only after reveal; pair ends at trick ≥ max(4, revealTrick+1)
  // This ensures pair start ≥ max(3, revealTrick)
  if (oppConsec >= 2 && trumpRevealed && rungRevealedOnTrick !== null) {
    const minEnd = Math.max(4, rungRevealedOnTrick + 1)
    if (trickNumber >= minEnd) {
      return { winner: `team${opponentTeam}` as 'teamA' | 'teamB', reason: 'opponent_consecutive' }
    }
  }

  // Trick 13 fallback: whoever wins trick 13 wins — revealed or not
  if (trickNumber === 13) {
    const last = trickWins[12]
    if (last) return { winner: `team${last}` as 'teamA' | 'teamB', reason: 'trick_13_fallback' }
  }

  return { winner: null, reason: 'ongoing' }
}

// ── Scenario B: Open Rung ─────────────────────────────────────────────────────
//
// Non-Calling wins : ≥2 consecutive, pair ending on trick ≥3 (starts at trick 2+)
// Calling   wins   : non-calling fails to achieve by trick 13
export function checkWinScenarioB(params: {
  consecutiveA:   number
  consecutiveB:   number
  trickNumber:    number
  callingTeam:   'A' | 'B'
}): WinState {
  const { consecutiveA, consecutiveB, trickNumber, callingTeam } = params
  const nonCallingTeam  = callingTeam === 'A' ? 'B' : 'A'
  const ncConsec        = nonCallingTeam === 'A' ? consecutiveA : consecutiveB

  // Non-calling: pair ends at trick ≥3 (2+3, 3+4, …)
  if (ncConsec >= 2 && trickNumber >= 3) {
    return { winner: `team${nonCallingTeam}` as 'teamA' | 'teamB', reason: 'non_calling_consecutive' }
  }

  // Calling team wins if non-calling never achieved their condition
  if (trickNumber === 13) {
    return { winner: `team${callingTeam}` as 'teamA' | 'teamB', reason: 'calling_team_survives' }
  }

  return { winner: null, reason: 'ongoing' }
}

// ── Ace-exception "would this consecutive win?" ───────────────────────────────
// Returns true if the team's CURRENT consecutive count meets the win-condition
// threshold for this scenario/trickNumber. Used only to detect Ace Exception.
export function wouldConsecutiveWin(params: {
  consecutive:         number
  trickNumber:         number
  scenario:           'A' | 'B' | null
  isRungHolder:        boolean
  trumpRevealed:       boolean
  rungRevealedOnTrick: number | null
  isCallingTeam:       boolean
}): boolean {
  const { consecutive, trickNumber, scenario, isRungHolder, trumpRevealed, rungRevealedOnTrick, isCallingTeam } = params
  if (consecutive < 2) return false

  if (scenario === 'A') {
    if (isRungHolder) return trickNumber >= 9
    // Opponent
    if (trumpRevealed && rungRevealedOnTrick !== null) {
      return trickNumber >= Math.max(4, rungRevealedOnTrick + 1)
    }
  }

  if (scenario === 'B') {
    if (!isCallingTeam) return trickNumber >= 3
  }

  return false
}
