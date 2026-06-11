import { create } from 'zustand'
import { GameState, Card, TrickCard, Team } from '@/types/game.types'

export interface TossResult {
  tossCards: { playerId: string; card: Card }[]
  winnerPlayerId: string
  winnerTeam: 'A' | 'B'
}

export interface ColorCaller {
  callerId: string
  suit: string
}

export interface LastCardPlayed {
  playerId: string
  card: Card
  trickNumber: number
}

export interface RungRevealInfo {
  card: Card
  suit: string
  triggeredBy: string
  trickNumber: number
}

export interface TrickWinnerInfo {
  trickNumber:  number
  winnerId:     string
  winnerTeam:   Team
  winningCard:  Card
  cards:        TrickCard[]
  consecutiveA: number
  consecutiveB: number
}

export interface DealBatch {
  batch:          1 | 2 | 3
  cardsPerPlayer: number
}

/** Dedicated store for round_over event data — never overwritten by game_state */
export interface RoundOverInfo {
  winnerTeam:          'A' | 'B'
  loserTeam:           'A' | 'B'
  reason:              string
  kothi:               'A' | 'B' | null
  kothiCounter:        number
  trickWins:           Array<'A' | 'B'>
  tricksPlayed:        number
  consecutiveA:        number
  consecutiveB:        number
  scenario:            'A' | 'B' | null
  callingTeam:         'A' | 'B' | null
  rungHolderId:        string | null
  rungRevealedOnTrick: number | null
}

interface GameStore {
  state:           GameState | null
  myHand:          Card[]
  selectedCard:    Card | null
  lastEvent:       string | null
  tossResult:      TossResult | null
  colorCaller:     ColorCaller | null
  lastCardPlayed:  LastCardPlayed | null
  hiddenRungCard:  Card | null
  rungRevealInfo:  RungRevealInfo | null
  lastTrick:       TrickWinnerInfo | null
  dealQueue:       DealBatch[]
  gameError:       string | null
  /** Round-over snapshot — never overwritten by game_state events */
  roundOverInfo:   RoundOverInfo | null

  setState:           (s: GameState | ((prev: GameState | null) => GameState | null)) => void
  setHand:            (hand: Card[]) => void
  selectCard:         (card: Card | null) => void
  setLastEvent:       (event: string) => void
  setGameError:       (err: string | null) => void
  setTossResult:      (result: TossResult | null) => void
  setColorCaller:     (caller: ColorCaller | null) => void
  setLastCardPlayed:  (info: LastCardPlayed | null) => void
  setHiddenRungCard:  (card: Card | null) => void
  setRungRevealInfo:  (info: RungRevealInfo | null) => void
  setLastTrick:       (trick: TrickWinnerInfo | null) => void
  setRoundOverInfo:   (info: RoundOverInfo | null) => void
  pushDealBatch:      (batch: DealBatch) => void
  popDealBatch:       () => void
  reset:              () => void
}

export const useGameStore = create<GameStore>(set => ({
  state:          null,
  myHand:         [],
  selectedCard:   null,
  lastEvent:      null,
  tossResult:     null,
  colorCaller:    null,
  lastCardPlayed: null,
  hiddenRungCard: null,
  rungRevealInfo: null,
  lastTrick:      null,
  dealQueue:      [],
  gameError:      null,
  roundOverInfo:  null,

  setState:          updater => set(prev => ({
    state: typeof updater === 'function' ? updater(prev.state) : updater,
  })),
  setHand:           hand   => set({ myHand: hand }),
  selectCard:        card   => set({ selectedCard: card }),
  setLastEvent:      event  => set({ lastEvent: event }),
  setGameError:      err    => set({ gameError: err }),
  setTossResult:     result => set({ tossResult: result }),
  setColorCaller:    caller => set({ colorCaller: caller }),
  setLastCardPlayed: info   => set({ lastCardPlayed: info }),
  setHiddenRungCard: card   => set({ hiddenRungCard: card }),
  setRungRevealInfo: info   => set({ rungRevealInfo: info }),
  setLastTrick:      trick  => set({ lastTrick: trick }),
  setRoundOverInfo:  info   => set({ roundOverInfo: info }),
  pushDealBatch:     batch  => set(prev => ({ dealQueue: [...prev.dealQueue, batch] })),
  popDealBatch:      ()     => set(prev => ({ dealQueue: prev.dealQueue.slice(1) })),
  reset: () => set({
    state: null, myHand: [], selectedCard: null, lastEvent: null,
    tossResult: null, colorCaller: null, lastCardPlayed: null,
    hiddenRungCard: null, rungRevealInfo: null, lastTrick: null,
    dealQueue: [], gameError: null, roundOverInfo: null,
  }),
}))
