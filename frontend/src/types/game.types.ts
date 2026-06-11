export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'
export type Team = 'A' | 'B'
export type Scenario = 'A' | 'B' | null
export type GamePhase =
  | 'toss'
  | 'awaiting_deal'
  | 'dealing_batch1'
  | 'rung_selection'
  | 'dealing_batch2'
  | 'dealing_batch3'
  | 'color_call'
  | 'playing'
  | 'round_over'

export interface Card {
  suit: Suit
  rank: Rank
}

export interface TrickCard {
  playerId: string
  card: Card
}

export interface PlayerPublicInfo {
  id: string
  type: 'human' | 'computer'
  team: Team
  position: 0 | 1 | 2 | 3
  displayName: string
}

/**
 * Mirrors the server-side GameSnapshot (minus `hands`).
 * Field names must exactly match what game-engine sends via socket.io.
 */
export interface GameState {
  phase: GamePhase
  scenario: Scenario
  trumpSuit: Suit | null
  trumpRevealed: boolean
  rungHolderId: string | null
  currentTrick: TrickCard[]
  trickNumber: number
  /** One entry per completed trick — 'A' or 'B' indicating which team won it */
  trickWins: Team[]
  /** How many consecutive tricks Team A currently holds */
  consecutiveA: number
  /** How many consecutive tricks Team B currently holds */
  consecutiveB: number
  kothiCounter: number
  leadPlayerId: string | null
  /** All players with their seat positions — use to map playerId → seat for rendering */
  players: PlayerPublicInfo[]
  /** True while the hidden rung card is face-down on the table (Scenario A, pre-reveal) */
  hasHiddenRung: boolean
  /** Stored toss result — available for late-joining clients to show the toss overlay */
  tossResult: {
    tossCards: { playerId: string; card: Card }[]
    winnerPlayerId: string
    winnerTeam: Team
  } | null
  dealingTeam: Team
  playedCards: Card[]
  /** Number of cards in each player's hand (public, keyed by playerId) */
  handCounts?: Record<string, number>
}
