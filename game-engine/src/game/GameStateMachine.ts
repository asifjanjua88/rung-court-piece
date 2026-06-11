import { Card, Suit, buildDeck, shuffle, dealBatches, rankValue } from './Deck'
import { TrickCard, evaluateTrick, canFollowSuit } from './Trick'
import { checkWinScenarioA, checkWinScenarioB, wouldConsecutiveWin } from './WinCondition'
import { AceExceptionState } from './AceException'
import { chooseCard, chooseHiddenRung, shouldCallColor, Difficulty } from '../ai/AIPlayer'

// ── Special error carrying pre-reveal events so GameRoom can flush them ───────
export class MustPlayTrumpError extends Error {
  constructor(public readonly pendingEvents: GameEvent[]) {
    super('MUST_PLAY_TRUMP')
    this.name = 'MustPlayTrumpError'
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type GamePhase =
  | 'toss'
  | 'awaiting_deal'     // toss done — waiting for dealing-team player to click Deal
  | 'dealing_batch1'
  | 'rung_selection'
  | 'rung_placed'       // rung card chosen — waiting for batch2 timer
  | 'dealing_batch2'
  | 'dealing_batch3'
  | 'color_call'
  | 'playing'
  | 'round_over'

export type Scenario = 'A' | 'B' | null
export type Team = 'A' | 'B'

export interface PlayerInfo {
  id: string
  type: 'human' | 'computer'
  difficulty?: Difficulty
  team: Team                  // A = North/South (positions 0,2), B = East/West (positions 1,3)
  position: 0 | 1 | 2 | 3
  displayName?: string        // Human display name or bot name
}

export interface GameEvent {
  type: string
  payload: Record<string, unknown>
}

export interface PlayerPublicInfo {
  id: string
  type: 'human' | 'computer'
  team: Team
  position: 0 | 1 | 2 | 3
  displayName: string         // Human display name or bot name (e.g. "Faisal", "John", "Qasim")
}

export interface TossResultSnapshot {
  tossCards: { playerId: string; card: Card }[]
  winnerPlayerId: string
  winnerTeam: Team
}

export interface GameSnapshot {
  phase: GamePhase
  scenario: Scenario
  trumpSuit: Suit | null
  trumpRevealed: boolean
  rungHolderId: string | null
  currentTrick: TrickCard[]
  trickNumber: number
  trickWins: Team[]
  consecutiveA: number
  consecutiveB: number
  lastTrickWinnerId: string | null   // player who won the most-recent trick (for same-player consecutive rule)
  kothiCounter: number
  leadPlayerId: string
  aceException: AceExceptionState
  players: PlayerPublicInfo[]          // all player positions/teams (no cards)
  hasHiddenRung: boolean               // true while rung card is face-down on table (Scenario A pre-reveal)
  tossResult: TossResultSnapshot | null // stored so late-joining clients can show the toss
  dealingTeam: Team                    // which team is dealing this round
  hands: Record<string, Card[]>        // playerId → cards (server-side only)
  playedCards: Card[]                  // all cards played across all tricks
  handCounts?: Record<string, number>  // injected by getSnapshot() — NOT stored in state
}

// ─── GameStateMachine ─────────────────────────────────────────────────────────

export class GameStateMachine {
  private players: PlayerInfo[]
  private state: GameSnapshot
  private events: GameEvent[] = []

  constructor(players: PlayerInfo[]) {
    if (players.length !== 4) throw new Error('Exactly 4 players required')
    this.players = players
    this.state = this.initialState()
  }

  // ── Initial state ────────────────────────────────────────────────────────────

  private initialState(): GameSnapshot {
    return {
      phase: 'toss',
      scenario: null,
      trumpSuit: null,
      trumpRevealed: false,
      rungHolderId: null,
      currentTrick: [],
      trickNumber: 1,
      trickWins: [],
      consecutiveA: 0,
      consecutiveB: 0,
      lastTrickWinnerId: null,
      kothiCounter: 0,
      leadPlayerId: this.players[0].id,
      aceException: { active: false, teamThatPlayedAce: null, playerThatPlayedAce: null },
      players: this.players.map(p => ({
        id: p.id,
        type: p.type,
        team: p.team,
        position: p.position,
        displayName: p.displayName ?? (p.type === 'computer' ? `Bot ${p.position}` : 'Player'),
      })),
      hasHiddenRung: false,
      tossResult: null,
      dealingTeam: 'A',
      hands: {},
      playedCards: [],
    }
  }

  // ── Public: start a round ────────────────────────────────────────────────────

  startRound(dealingTeam: Team): GameEvent[] {
    this.events = []
    this.state = this.initialState()
    this._dealingTeam = dealingTeam
    this.state.dealingTeam = dealingTeam

    this.runToss()

    // runToss() updates this._dealingTeam to the toss LOSER (they deal)
    // Use this._dealingTeam here (not the original parameter)
    this.state.dealingTeam = this._dealingTeam

    // Pause here — wait for dealing team to click Deal
    this.state.phase = 'awaiting_deal'
    this.emit('awaiting_deal', {
      dealingTeam: this._dealingTeam,
      message: `Team ${this._dealingTeam} — click Deal to distribute cards`,
    })

    return this.flushEvents()
  }

  /** Called when dealing-team player clicks "Deal Cards" */
  triggerDeal(playerId: string): GameEvent[] {
    this.events = []
    if (this.state.phase !== 'awaiting_deal') throw new Error('WRONG_PHASE')
    this.runDeal()
    return this.flushEvents()
  }

  private _dealingTeam: Team = 'A'

  // ── Toss ─────────────────────────────────────────────────────────────────────

  private runToss(): void {
    this.state.phase = 'toss'
    const deck = shuffle(buildDeck())
    const tossCards: TrickCard[] = this.players.map((p, i) => ({
      playerId: p.id,
      card: deck[i],
    }))

    // Find overall highest toss card
    let winner = tossCards[0]
    for (const tc of tossCards) {
      if (rankValue(tc.card.rank) > rankValue(winner.card.rank)) winner = tc
    }

    // Tiebreak: two players same rank — compare their partners
    const maxRank = rankValue(winner.card.rank)
    const topCards = tossCards.filter(tc => rankValue(tc.card.rank) === maxRank)
    if (topCards.length > 1) {
      // Teams of tied players: find which team's OTHER partner has higher card
      const teamA = this.players.filter(p => p.team === 'A').map(p => p.id)
      const teamB = this.players.filter(p => p.team === 'B').map(p => p.id)
      const aScore = tossCards.filter(tc => teamA.includes(tc.playerId))
        .reduce((s, tc) => s + rankValue(tc.card.rank), 0)
      const bScore = tossCards.filter(tc => teamB.includes(tc.playerId))
        .reduce((s, tc) => s + rankValue(tc.card.rank), 0)
      // Winning team is the one with higher combined toss score
      const winningTeam: Team = aScore >= bScore ? 'A' : 'B'
      winner = tossCards.find(tc =>
        this.players.find(p => p.id === tc.playerId)?.team === winningTeam
      )!
    }

    const winnerPlayer = this.players.find(p => p.id === winner.playerId)!

    const tossPayload = {
      tossCards: tossCards.map(tc => ({ playerId: tc.playerId, card: tc.card })),
      winnerPlayerId: winner.playerId,
      winnerTeam: winnerPlayer.team,
    }

    // Persist in snapshot so late-joining game page clients can see the toss result
    this.state.tossResult = tossPayload

    // ── Toss loser deals: opposite team of winner ─────────────────────────────
    const dealingTeam: Team = winnerPlayer.team === 'A' ? 'B' : 'A'
    this._dealingTeam = dealingTeam
    this.state.dealingTeam = dealingTeam

    this.emit('toss_result', tossPayload)
  }

  // ── Deal ─────────────────────────────────────────────────────────────────────

  private runDeal(): void {
    // Deal counter-clockwise: player order by position 0,3,2,1 (counter-clockwise)
    const orderedPlayers = [0, 3, 2, 1].map(pos => this.players.find(p => p.position === pos)!)
    const deck = shuffle(buildDeck())
    const batches = dealBatches(deck, 4)

    // ── Store batches so dealRemainingBatches() uses the SAME deck ──────────────
    this._dealBatches = batches

    // Assign batch 1 (5 cards each) in counter-clockwise order
    this.state.phase = 'dealing_batch1'
    orderedPlayers.forEach((p, i) => {
      this.state.hands[p.id] = batches[i].slice(0, 5)
    })

    this.emit('batch1_dealt', {
      hands: this.sanitiseHands(),  // server sends each player only their own hand
    })

    // Rung Holder: position 0 for team A, position 1 for team B (lowest position of dealing team)
    this.state.phase = 'rung_selection'
    const dealingTeam = this._dealingTeam
    const rungHolderPos = dealingTeam === 'A' ? 0 : 1
    const rungHolder = this.players.find(p => p.position === rungHolderPos)!
    this.state.rungHolderId = rungHolder.id

    let hiddenRung: Card
    if (rungHolder.type === 'computer') {
      hiddenRung = chooseHiddenRung(rungHolder.difficulty!, this.state.hands[rungHolder.id])
    } else {
      // For human: wait for client event — handled via selectHiddenRung()
      this.emit('awaiting_rung_selection', { rungHolderId: rungHolder.id })
      return
    }

    this.setHiddenRung(rungHolder.id, hiddenRung)
  }

  // ── Human selects Hidden Rung (called from WebSocket handler) ────────────────

  selectHiddenRung(playerId: string, card: Card): GameEvent[] {
    this.events = []
    if (playerId !== this.state.rungHolderId) throw new Error('NOT_RUNG_HOLDER')
    if (this.state.phase !== 'rung_selection') throw new Error('WRONG_PHASE')
    if (!this.state.hands[playerId].some(c => c.suit === card.suit && c.rank === card.rank)) {
      throw new Error('CARD_NOT_IN_HAND')
    }

    this.setHiddenRung(playerId, card)
    return this.flushEvents()
  }

  private setHiddenRung(playerId: string, card: Card): void {
    // Remove from hand and store as hidden
    this.state.hands[playerId] = this.state.hands[playerId].filter(
      c => !(c.suit === card.suit && c.rank === card.rank)
    )
    this._hiddenRungCard = card
    this.state.hasHiddenRung = true

    // Immediately move out of rung_selection so the picker overlay hides at once
    this.state.phase = 'rung_placed'

    this.emit('rung_selected', { rungHolderId: playerId })

    // ── Signal GameRoom to deal batch 2 after animation delay (NOT immediate) ──
    this._batch2Pending = true
  }

  private _hiddenRungCard: Card | null = null
  /** Persisted deal batches — set in runDeal(), reused for batch2/3 */
  private _dealBatches: Card[][] | null = null
  private _batch2Pending = false
  private _batch3Pending = false

  get batch2Pending(): boolean { return this._batch2Pending }
  get batch3Pending(): boolean { return this._batch3Pending }

  /** Called by GameRoom ~3s after rung_selected (batch1 animation finishes) */
  dealBatch2(): GameEvent[] {
    this.events = []
    this._batch2Pending = false
    const orderedPlayers = [0, 3, 2, 1].map(pos => this.players.find(p => p.position === pos)!)
    const batches = this._dealBatches!

    this.state.phase = 'dealing_batch2'
    orderedPlayers.forEach((p, i) => {
      this.state.hands[p.id].push(...batches[i].slice(5, 9))
    })
    this.emit('batch2_dealt', { hands: this.sanitiseHands() })
    this._batch3Pending = true   // batch3 follows
    return this.flushEvents()
  }

  /** Called by GameRoom ~2.5s after batch2 animation finishes */
  dealBatch3(): GameEvent[] {
    this.events = []
    this._batch3Pending = false
    const orderedPlayers = [0, 3, 2, 1].map(pos => this.players.find(p => p.position === pos)!)
    const batches = this._dealBatches!

    this.state.phase = 'dealing_batch3'
    orderedPlayers.forEach((p, i) => {
      this.state.hands[p.id].push(...batches[i].slice(9, 13))
    })
    this.emit('batch3_dealt', { hands: this.sanitiseHands() })
    this.beginColorCallPhase()
    return this.flushEvents()
  }

  // ── Color Call Phase ─────────────────────────────────────────────────────────

  private beginColorCallPhase(): void {
    this.state.phase = 'color_call'

    // Check if any computer player (non-rung-holder) wants to call color
    for (const p of this.players) {
      if (p.id === this.state.rungHolderId) continue
      if (p.type !== 'computer') continue

      const calledSuit = shouldCallColor(p.difficulty!, this.state.hands[p.id])
      if (calledSuit) {
        this.applyColorCall(p.id, calledSuit)
        return
      }
    }

    // If all computers pass, ask humans
    this.emit('color_call_open', {
      rungHolderId: this.state.rungHolderId,
      message: 'Any player would like to call the color?',
    })

    // If no human responds (handled by callColor() from WebSocket),
    // the game will proceed to Scenario A via startPlaying()
  }

  // ── Human calls color (from WebSocket handler) ───────────────────────────────

  callColor(playerId: string, suit: Suit): GameEvent[] {
    this.events = []
    if (this.state.phase !== 'color_call') throw new Error('WRONG_PHASE')
    if (playerId === this.state.rungHolderId) throw new Error('RUNG_HOLDER_CANNOT_CALL')

    this.applyColorCall(playerId, suit)
    return this.flushEvents()
  }

  // ── Nobody calls — start Scenario A ──────────────────────────────────────────

  passColorCall(): GameEvent[] {
    this.events = []
    if (this.state.phase !== 'color_call') throw new Error('WRONG_PHASE')

    this.state.scenario = 'A'
    this.state.leadPlayerId = this.state.rungHolderId!

    this.emit('scenario_a_start', {
      leadPlayerId: this.state.leadPlayerId,
      message: 'Nobody called. Hidden Rung active. Rung Holder leads.',
    })

    this.state.phase = 'playing'
    this.triggerAIIfNeeded()
    return this.flushEvents()
  }

  private applyColorCall(callerId: string, suit: Suit): void {
    this.state.scenario = 'B'
    this._callingTeam = this.getTeamOf(callerId)   // ← must be set before any win checks
    this.state.trumpSuit = suit
    this.state.trumpRevealed = true

    // Return the hidden rung card to the Rung Holder's hand in Scenario B too.
    // The hidden card is no longer needed as the trump suit was called explicitly.
    if (this._hiddenRungCard && this.state.rungHolderId) {
      this.state.hands[this.state.rungHolderId].push(this._hiddenRungCard)
      // Notify rung holder their hand grew
      this.emit('hand_update_for', {
        playerId: this.state.rungHolderId,
        hand: this.state.hands[this.state.rungHolderId],
      })
    }
    this._hiddenRungCard = null
    this.state.hasHiddenRung = false  // returned to hand or discarded

    this.emit('color_called', {
      callerId,
      suit,
      message: `${suit} called as trump! Hidden card returned to Rung Holder.`,
    })

    this.state.leadPlayerId = callerId
    this.state.phase = 'playing'

    this.emit('scenario_b_start', {
      leadPlayerId: callerId,
      trumpSuit: suit,
    })

    this.triggerAIIfNeeded()
  }

  // ── Play a card (human) ───────────────────────────────────────────────────────

  playCard(playerId: string, card: Card): GameEvent[] {
    this.events = []

    if (this.state.phase !== 'playing') throw new Error('WRONG_PHASE')

    const expectedPlayer = this.getTurnPlayer()
    if (expectedPlayer.id !== playerId) throw new Error('NOT_YOUR_TURN')

    try {
      this.validateAndPlayCard(playerId, card)
    } catch (err) {
      if (err instanceof Error && err.message === 'MUST_PLAY_TRUMP') {
        // revealRung() fired before the throw — rung_revealed events are already
        // queued in this.events. Re-throw a richer error so GameRoom can flush
        // those pending events to clients (keeping them in sync) before sending
        // the error to the human player.
        throw new MustPlayTrumpError(this.flushEvents())
      }
      throw err
    }

    return this.flushEvents()
  }

  /** Flush any events accumulated so far without clearing pending-play state. */
  flushPendingEvents(): GameEvent[] {
    return this.flushEvents()
  }

  // ── Core card play logic ──────────────────────────────────────────────────────

  private validateAndPlayCard(playerId: string, card: Card): void {
    const hand = this.state.hands[playerId]
    const player = this.players.find(p => p.id === playerId)!

    // Check card is in hand
    if (!hand.some(c => c.suit === card.suit && c.rank === card.rank)) {
      throw new Error('CARD_NOT_IN_HAND')
    }

    const ledSuit = this.state.currentTrick.length > 0
      ? this.state.currentTrick[0].card.suit
      : null

    // ── Revoke check ──────────────────────────────────────────────────────────
    if (ledSuit && canFollowSuit(hand, ledSuit) && card.suit !== ledSuit) {
      // Player must follow suit but is playing a different suit — revoke!
      this.handleRevoke(playerId)
      return
    }

    // ── Scenario A: Rung reveal trigger ──────────────────────────────────────
    if (
      this.state.scenario === 'A' &&
      !this.state.trumpRevealed &&
      ledSuit &&
      !canFollowSuit(hand, ledSuit)
    ) {
      const isOpponent = player.team !== this.getTeamOf(this.state.rungHolderId!)

      if (isOpponent) {
        // Opponent cannot follow suit — reveal the rung!
        this.revealRung(playerId)
        // After reveal, player must play trump if they have it
        const trumpCards = hand.filter(c => c.suit === this.state.trumpSuit)
        if (trumpCards.length > 0 && !trumpCards.some(c => c.suit === card.suit && c.rank === card.rank)) {
          throw new Error('MUST_PLAY_TRUMP')
        }
      }
      // Own team cannot follow suit → play any card freely (no reveal)
    }

    // ── Remove card from hand ─────────────────────────────────────────────────
    this.state.hands[playerId] = hand.filter(
      c => !(c.suit === card.suit && c.rank === card.rank)
    )

    // ── Add to current trick ──────────────────────────────────────────────────
    this.state.currentTrick.push({ playerId, card })
    this.state.playedCards.push(card)

    this.emit('card_played', {
      playerId,
      card,
      trickNumber: this.state.trickNumber,
    })

    // ── Rung Holder plays face-down decoy (Scenario A, can't follow suit, own team) ──
    if (
      this.state.scenario === 'A' &&
      !this.state.trumpRevealed &&
      playerId === this.state.rungHolderId &&
      ledSuit &&
      !canFollowSuit(hand, ledSuit)
    ) {
      this.emit('rung_holder_decoy', {
        playerId,
        message: 'Rung Holder played a face-down decoy. Trump not yet revealed.',
      })
    }

    // ── All 4 cards played — evaluate trick ───────────────────────────────────
    if (this.state.currentTrick.length === 4) {
      this.evaluateCompletedTrick()
    } else {
      // Next player's turn
      this.triggerAIIfNeeded()
    }
  }

  // ── Evaluate completed trick ──────────────────────────────────────────────────

  private evaluateCompletedTrick(): void {
    const winner = evaluateTrick(this.state.currentTrick, this.state.trumpSuit)
    const winnerPlayer = this.players.find(p => p.id === winner.playerId)!
    const winnerTeam = winnerPlayer.team

    this.state.trickWins.push(winnerTeam)
    this.updateConsecutiveCount(winner.playerId, winnerTeam, winner.card)

    this.emit('trick_complete', {
      trickNumber:  this.state.trickNumber,
      winner:       winner.playerId,
      winnerTeam,
      winningCard:  winner.card,
      cards:        this.state.currentTrick,
      consecutiveA: this.state.consecutiveA,
      consecutiveB: this.state.consecutiveB,
    })

    // ── Check win condition ───────────────────────────────────────────────────
    const winResult = this.checkWin()

    if (winResult.winner) {
      this.endRound(winResult.winner, winResult.reason)
      return
    }

    // ── Next trick ────────────────────────────────────────────────────────────
    this.state.trickNumber++
    this.state.currentTrick = []
    this.state.leadPlayerId = winner.playerId

    this.emit('next_trick', {
      trickNumber: this.state.trickNumber,
      leadPlayerId: winner.playerId,
    })

    this.triggerAIIfNeeded()
  }

  // ── Consecutive trick tracking with Ace Exception ────────────────────────────
  //
  // Uses consecutive COUNTERS (not raw trickWins) so that Ace Exception resets
  // are honoured: after a reset the old pair in trickWins must not retrigger.
  //
  // Ace Exception rules:
  //   • If an Ace wins the "would-be game-ending" 2nd consecutive trick → deferred
  //   • Next trick, SAME team wins non-Ace → game ends (checkWin fires normally)
  //   • Next trick, SAME team wins another Ace → streak resets (both → 0, winner → 1)
  //   • Next trick, OTHER team wins  → both reset, other team gets +1

  private updateConsecutiveCount(winnerId: string, winnerTeam: Team, winningCard: Card): void {
    const { aceException } = this.state

    // ── Resolve active Ace Exception ──────────────────────────────────────────
    // The Ace Exception was triggered by a specific player (playerThatPlayedAce).
    // Only that SAME PLAYER winning again resolves the exception normally.
    // Any other player winning (even a teammate) breaks the streak.
    if (aceException.active) {
      if (winnerId === aceException.playerThatPlayedAce) {
        // Same player wins again
        if (winningCard.rank === 'A') {
          // Same player played Ace AGAIN — streak resets, winner starts at 1
          this.state.consecutiveA = 0
          this.state.consecutiveB = 0
          if (winnerTeam === 'A') this.state.consecutiveA = 1
          else                    this.state.consecutiveB = 1
          aceException.active = false
          aceException.teamThatPlayedAce = null
          aceException.playerThatPlayedAce = null
          this.emit('ace_exception_reset', { reason: 'Same player played Ace again — streak resets' })
        } else {
          // Same player, non-Ace → clear exception, count this win; checkWin will end the game
          if (winnerTeam === 'A') { this.state.consecutiveA++; this.state.consecutiveB = 0 }
          else                    { this.state.consecutiveB++; this.state.consecutiveA = 0 }
          aceException.active = false
          aceException.teamThatPlayedAce = null
          aceException.playerThatPlayedAce = null
        }
      } else {
        // Different player (teammate or opponent) wins → streak broken for both teams,
        // new winner starts at 1.
        this.state.consecutiveA = 0
        this.state.consecutiveB = 0
        if (winnerTeam === 'A') this.state.consecutiveA = 1
        else                    this.state.consecutiveB = 1
        aceException.active = false
        aceException.teamThatPlayedAce = null
        aceException.playerThatPlayedAce = null
        this.emit('ace_exception_reset', { reason: 'Different player won — streak resets for both teams' })
      }
      this.state.lastTrickWinnerId = winnerId
      return
    }

    // ── Normal consecutive counting (SAME-PLAYER RULE) ────────────────────────
    // Two consecutive tricks only count if the SAME INDIVIDUAL player wins both.
    // A teammate winning the next trick resets the streak to 1 for their team.
    if (winnerId === this.state.lastTrickWinnerId) {
      // Same player wins again → extend their streak
      if (winnerTeam === 'A') { this.state.consecutiveA++; this.state.consecutiveB = 0 }
      else                    { this.state.consecutiveB++; this.state.consecutiveA = 0 }
    } else {
      // New player wins (first trick, different player, or different team) →
      // reset both counters and give the new winner a streak of 1.
      this.state.consecutiveA = 0
      this.state.consecutiveB = 0
      if (winnerTeam === 'A') this.state.consecutiveA = 1
      else                    this.state.consecutiveB = 1
    }
    this.state.lastTrickWinnerId = winnerId

    // ── Check if Ace Exception applies ────────────────────────────────────────
    // If the current consecutive count would end the game AND the winning card
    // is an Ace → defer the win (Ace Exception rule).
    //
    // EXCEPTION TO THE EXCEPTION: trick 13 is the last trick — there is no trick
    // 14 to play, so we never defer at trick 13. Ace wins trick 13 → game ends.
    if (
      this.wouldWinWithCurrentConsecutive(winnerTeam) &&
      winningCard.rank === 'A' &&
      this.state.trickNumber < 13
    ) {
      aceException.active = true
      aceException.teamThatPlayedAce = winnerTeam
      aceException.playerThatPlayedAce = winnerId
      this.emit('ace_exception_triggered', {
        playerId: winnerId,
        message: 'Ace won the trick but cannot end the game — must win next trick with a non-Ace.',
      })
    }
  }

  // ── Would current consecutive count end the game right now? ──────────────────

  private wouldWinWithCurrentConsecutive(team: Team): boolean {
    const consecutive = team === 'A' ? this.state.consecutiveA : this.state.consecutiveB
    const rungHolderTeam = this.state.scenario === 'A'
      ? this.getTeamOf(this.state.rungHolderId!)
      : null

    return wouldConsecutiveWin({
      consecutive,
      trickNumber:         this.state.trickNumber,
      scenario:            this.state.scenario,
      isRungHolder:        team === rungHolderTeam,
      trumpRevealed:       this.state.trumpRevealed,
      rungRevealedOnTrick: this._rungRevealedOnTrick,
      isCallingTeam:       team === this._callingTeam,
    })
  }

  private _callingTeam: Team | null = null

  // ── Check win condition ────────────────────────────────────────────────────────
  //
  // IMPORTANT: uses consecutive COUNTERS, not raw trickWins.
  // After an Ace Exception reset both counters are 0, so old pairs in the raw
  // array cannot retrigger. checkWin is also blocked while aceException.active.

  private checkWin(): { winner: Team | null; reason: string } {
    const { trickNumber, scenario, consecutiveA, consecutiveB, aceException, trickWins } = this.state

    // Ace Exception active → win deferred until next trick.
    // BUT at trick 13 there is no next trick — game MUST end, ignore the exception.
    if (aceException.active && trickNumber < 13) return { winner: null, reason: 'ongoing' }

    if (scenario === 'A') {
      const rungHolderTeam = this.getTeamOf(this.state.rungHolderId!)
      const result = checkWinScenarioA({
        consecutiveA,
        consecutiveB,
        trickNumber,
        rungHolderTeam,
        trumpRevealed:       this.state.trumpRevealed,
        rungRevealedOnTrick: this._rungRevealedOnTrick,
        trickWins:           trickWins as Array<'A' | 'B'>,
      })
      if (result.winner === 'teamA') return { winner: 'A', reason: result.reason }
      if (result.winner === 'teamB') return { winner: 'B', reason: result.reason }
    }

    if (scenario === 'B') {
      const result = checkWinScenarioB({
        consecutiveA,
        consecutiveB,
        trickNumber,
        callingTeam: this._callingTeam!,
      })
      if (result.winner === 'teamA') return { winner: 'A', reason: result.reason }
      if (result.winner === 'teamB') return { winner: 'B', reason: result.reason }
    }

    return { winner: null, reason: 'ongoing' }
  }

  private _rungRevealedOnTrick: number | null = null

  // ── Rung reveal ───────────────────────────────────────────────────────────────

  private revealRung(triggeredByPlayerId: string): void {
    if (!this._hiddenRungCard) return
    this.state.trumpSuit = this._hiddenRungCard.suit
    this.state.trumpRevealed = true
    this._rungRevealedOnTrick = this.state.trickNumber

    // Return the hidden rung card to the rung holder's hand
    if (this.state.rungHolderId) {
      this.state.hands[this.state.rungHolderId].push(this._hiddenRungCard)
    }
    this.state.hasHiddenRung = false  // card is now revealed / back in hand

    this.emit('rung_revealed', {
      card: this._hiddenRungCard,
      suit: this.state.trumpSuit,
      triggeredBy: triggeredByPlayerId,
      trickNumber: this.state.trickNumber,
    })

    // Send the rung holder their updated hand immediately
    this.emit('hand_update_for', {
      playerId: this.state.rungHolderId,
      hand: this.state.rungHolderId ? this.state.hands[this.state.rungHolderId] : [],
    })

    this._hiddenRungCard = null
  }

  // ── Revoke handling ───────────────────────────────────────────────────────────

  private handleRevoke(revokerPlayerId: string): void {
    const revokerTeam = this.getTeamOf(revokerPlayerId)
    const winnerTeam: Team = revokerTeam === 'A' ? 'B' : 'A'

    this.emit('revoke', {
      revokerPlayerId,
      revokerTeam,
      penaltyTeam: revokerTeam,
      winnerTeam,
      message: 'Revoke! Opponent team wins the round.',
    })

    this.endRound(winnerTeam, 'revoke')
  }

  // ── End round ─────────────────────────────────────────────────────────────────

  private endRound(winnerTeam: Team, reason: string): void {
    this.state.phase = 'round_over'
    const loserTeam: Team = winnerTeam === 'A' ? 'B' : 'A'

    // Update Kothi counter
    if (winnerTeam === 'A') {
      this.state.kothiCounter--
    } else {
      this.state.kothiCounter++
    }

    let kothi: Team | null = null
    if (this.state.kothiCounter >= 4) {
      kothi = 'B'
      this.state.kothiCounter = 0
    } else if (this.state.kothiCounter <= -4) {
      kothi = 'A'
      this.state.kothiCounter = 0
    }

    this.emit('round_over', {
      winnerTeam,
      loserTeam,
      reason,
      kothiCounter: this.state.kothiCounter,
      kothi,
      trickWins: this.state.trickWins,
      tricksPlayed: this.state.trickNumber,
      consecutiveA: this.state.consecutiveA,
      consecutiveB: this.state.consecutiveB,
      scenario: this.state.scenario,
      callingTeam: this._callingTeam,
      rungHolderId: this.state.rungHolderId,
      rungRevealedOnTrick: this._rungRevealedOnTrick,
      message: kothi ? `Team ${kothi} receives a Kothi (Donkey)! Counter resets.` : null,
    })
  }

  // ── AI turn trigger ───────────────────────────────────────────────────────────
  // Instead of playing immediately (which bundles the AI card into the same event
  // batch as trick_complete), we just flag that an AI play is pending.
  // GameRoom reads this flag and schedules playAICard() after a 1.5s delay so
  // the client has time to animate the completed trick before the next card appears.

  private _aiPending = false
  get aiPending(): boolean { return this._aiPending }

  private triggerAIIfNeeded(): void {
    const current = this.getTurnPlayer()
    if (current.type !== 'computer') return
    this._aiPending = true   // GameRoom will call playAICard() after a delay
  }

  /** Called by GameRoom ~1.5s after trick_complete (or colour-call, etc.) */
  playAICard(): GameEvent[] {
    this.events = []
    this._aiPending = false

    const current = this.getTurnPlayer()
    if (current.type !== 'computer') return []

    const hand = this.state.hands[current.id]
    const ledSuit = this.state.currentTrick[0]?.card.suit ?? null
    const partnerPlayedCard = this.getPartnerCard(current)

    const card = chooseCard(current.difficulty!, {
      hand,
      currentTrick: this.state.currentTrick,
      ledSuit,
      trumpSuit: this.state.trumpSuit,
      trickNumber: this.state.trickNumber,
      playedCards: this.state.playedCards,
      consecutiveA: this.state.consecutiveA,
      consecutiveB: this.state.consecutiveB,
      scenario: this.state.scenario,
      myTeam: current.team,
      partnerPlayedCard,
    })

    try {
      this.validateAndPlayCard(current.id, card)
    } catch (err) {
      if (err instanceof Error && err.message === 'MUST_PLAY_TRUMP') {
        // revealRung() fired inside validateAndPlayCard — trump is now known.
        // The original card is still in hand (hand remove didn't happen before the throw).
        // Must play trump on this specific trick — pick highest trump card.
        const freshHand = this.state.hands[current.id]
        const trumpCards = freshHand.filter(c => c.suit === this.state.trumpSuit)
        const forced = trumpCards.length > 0
          ? trumpCards.reduce((best, c) => rankValue(c.rank) > rankValue(best.rank) ? c : best)
          : freshHand[0]   // no trump at all — play any card (should not happen by rules)
        this.validateAndPlayCard(current.id, forced)
      } else {
        throw err
      }
    }

    return this.flushEvents()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private getTurnPlayer(): PlayerInfo {
    if (this.state.currentTrick.length === 0) {
      return this.players.find(p => p.id === this.state.leadPlayerId)!
    }
    // Next player counter-clockwise from last to play
    const lastPlayerId = this.state.currentTrick[this.state.currentTrick.length - 1].playerId
    const lastPlayer = this.players.find(p => p.id === lastPlayerId)!
    const nextPosition = (lastPlayer.position + 3) % 4 as 0 | 1 | 2 | 3
    return this.players.find(p => p.position === nextPosition)!
  }

  private getTeamOf(playerId: string): Team {
    return this.players.find(p => p.id === playerId)!.team
  }

  private getPartnerCard(player: PlayerInfo): TrickCard | null {
    const partnerPos = (player.position + 2) % 4
    const partner = this.players.find(p => p.position === partnerPos)
    if (!partner) return null
    return this.state.currentTrick.find(tc => tc.playerId === partner.id) ?? null
  }

  private sanitiseHands(): Record<string, Card[]> {
    // Returns all hands (server-side); WebSocket layer will filter per-player
    return { ...this.state.hands }
  }

  private emit(type: string, payload: Record<string, unknown>): void {
    this.events.push({ type, payload })
  }

  private flushEvents(): GameEvent[] {
    const events = [...this.events]
    this.events = []
    return events
  }

  // ── Public getters ────────────────────────────────────────────────────────────

  getPhase(): GamePhase { return this.state.phase }
  getSnapshot(): Omit<GameSnapshot, 'hands'> & { handCounts: Record<string, number> } {
    const { hands, ...rest } = this.state
    const handCounts: Record<string, number> = {}
    for (const [playerId, cards] of Object.entries(hands)) {
      handCounts[playerId] = cards.length
    }
    return { ...rest, handCounts }
  }
  getHandFor(playerId: string): Card[] {
    return this.state.hands[playerId] ?? []
  }
}
