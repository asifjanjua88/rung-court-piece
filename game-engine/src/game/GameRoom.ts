import { Server, Socket } from 'socket.io'
import { GameStateMachine, MustPlayTrumpError, PlayerInfo, GameEvent, Team } from './GameStateMachine'
import { Card, Suit } from './Deck'

export interface RoomSlot {
  position: 0 | 1 | 2 | 3
  type: 'human' | 'computer'
  playerId: string        // uuid for humans, 'computer-{position}' for AI
  difficulty?: 'easy' | 'medium' | 'hard'
  displayName?: string    // human username or bot name (e.g. "Faisal")
}

export class GameRoom {
  readonly roomId: string
  private slots: RoomSlot[]
  private sockets: Map<string, Socket> = new Map()  // playerId → socket
  private machine: GameStateMachine | null = null
  private dealingTeam: Team = 'A'
  private io: Server

  constructor(roomId: string, slots: RoomSlot[], io: Server) {
    this.roomId = roomId
    this.slots = slots
    this.io = io
  }

  // ── Player connects via WebSocket ────────────────────────────────────────────

  join(socket: Socket, playerId: string): void {
    const slot = this.slots.find(s => s.playerId === playerId)
    if (!slot) { socket.emit('error', { message: 'Not in this room' }); return }

    this.sockets.set(playerId, socket)
    socket.join(this.roomId)
    socket.emit('room_joined', { roomId: this.roomId, position: slot.position })

    // If game already started (player reconnected or joined late), send current state
    if (this.machine) {
      socket.emit('game_state', this.machine.getSnapshot())
      socket.emit('hand_update', { hand: this.machine.getHandFor(playerId) })
    }

    this.broadcastToRoom('player_connected', { playerId, position: slot.position })
  }

  // ── Start game (called when all slots filled and creator triggers start) ──────

  startGame(): void {
    const players: PlayerInfo[] = this.slots.map(s => ({
      id: s.playerId,
      type: s.type,
      difficulty: s.difficulty,
      team: (s.position === 0 || s.position === 2) ? 'A' : 'B',
      position: s.position,
      displayName: s.displayName,
    }))

    this.machine = new GameStateMachine(players)
    const events = this.machine.startRound(this.dealingTeam)
    this.dispatchEvents(events)
  }

  // ── Dealing team triggers the deal ───────────────────────────────────────────

  onDealCards(playerId: string): void {
    if (!this.machine) return
    try {
      const events = this.machine.triggerDeal(playerId)
      this.dispatchEvents(events)
    } catch (err: unknown) {
      this.emitError(playerId, err)
    }
  }

  // ── Human selects Hidden Rung card ───────────────────────────────────────────

  onSelectHiddenRung(playerId: string, card: Card): void {
    if (!this.machine) return
    try {
      const events = this.machine.selectHiddenRung(playerId, card)
      this.dispatchEvents(events)
    } catch (err: unknown) {
      this.emitError(playerId, err)
    }
  }

  // ── Human calls color ─────────────────────────────────────────────────────────

  onCallColor(playerId: string, suit: Suit): void {
    if (!this.machine) return
    try {
      const events = this.machine.callColor(playerId, suit)
      this.dispatchEvents(events)
    } catch (err: unknown) {
      this.emitError(playerId, err)
    }
  }

  // ── Human passes color call (nobody wants to call) ────────────────────────────

  onPassColorCall(playerId: string): void {
    if (!this.machine) return
    // Only Rung Holder can declare "nobody called"
    try {
      const events = this.machine.passColorCall()
      this.dispatchEvents(events)
    } catch (err: unknown) {
      this.emitError(playerId, err)
    }
  }

  // ── Human plays a card ────────────────────────────────────────────────────────

  onPlayCard(playerId: string, card: Card): void {
    if (!this.machine) return
    try {
      const events = this.machine.playCard(playerId, card)
      this.dispatchEvents(events)
    } catch (err: unknown) {
      if (err instanceof MustPlayTrumpError) {
        // The rung was revealed during this play (rung_revealed events queued)
        // but the card was invalid (not trump). Flush the reveal events so all
        // clients see the trump announcement, then tell the human to play trump.
        if (err.pendingEvents.length > 0) {
          this.dispatchEvents(err.pendingEvents)
        }
        this.emitError(playerId, new Error('MUST_PLAY_TRUMP'))
      } else {
        this.emitError(playerId, err)
      }
    }
  }

  // ── Event dispatcher ──────────────────────────────────────────────────────────
  // Each event is broadcast to the room, but hand-specific events are sent
  // only to the relevant player (privacy of cards)

  private dispatchEvents(events: GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {

        // Hand events — sent only to the specific player, but ALSO broadcast
        // a 'batch_dealt' signal so ALL clients can play the deal animation
        case 'batch1_dealt':
        case 'batch2_dealt':
        case 'batch3_dealt': {
          const hands = event.payload.hands as Record<string, Card[]>
          for (const [pid, hand] of Object.entries(hands)) {
            const socket = this.sockets.get(pid)
            socket?.emit(event.type, { hand })
          }
          // Signal every client to animate this deal batch
          const batchNum = event.type === 'batch1_dealt' ? 1
                         : event.type === 'batch2_dealt' ? 2 : 3
          this.broadcastToRoom('batch_dealt', {
            batch: batchNum,
            cardsPerPlayer: batchNum === 1 ? 5 : 4,
          })
          break
        }

        // hand_update_for — targeted to one player (e.g. rung holder gets hidden card back)
        case 'hand_update_for': {
          const pid = event.payload.playerId as string
          const hand = event.payload.hand as Card[]
          const socket = this.sockets.get(pid)
          socket?.emit('hand_update', { hand })
          break
        }

        // All other events broadcast to room
        default:
          this.broadcastToRoom(event.type, event.payload)
      }
    }

    // After each batch of events, send each human their current hand state
    if (this.machine) {
      for (const [pid, socket] of this.sockets) {
        socket.emit('hand_update', { hand: this.machine.getHandFor(pid) })
      }
      // Also broadcast public game snapshot (no hands)
      this.broadcastToRoom('game_state', this.machine.getSnapshot())

      // ── Async AI card play ───────────────────────────────────────────────
      if (this.machine.aiPending) {
        this.scheduleAIPlay(1500)
      }

      // ── Async batch dealing ──────────────────────────────────────────────
      // batch1 animation takes ~3s (20 cards × 140ms). Batch2 starts after.
      // batch2 animation takes ~2.5s (16 cards × 140ms). Batch3 starts after.
      if (this.machine.batch2Pending) {
        this.scheduleDealBatch(2, 3200)
      } else if (this.machine.batch3Pending) {
        this.scheduleDealBatch(3, 2800)
      }
    }
  }

  private scheduleAIPlay(delayMs: number): void {
    if (!this.machine) return
    setTimeout(() => {
      if (!this.machine) return
      try {
        const events = this.machine.playAICard()
        if (events.length > 0) this.dispatchEvents(events)
      } catch (err) {
        console.error('[GameRoom] AI play error:', err)
      }
    }, delayMs)
  }

  private scheduleDealBatch(batch: 2 | 3, delayMs: number): void {
    if (!this.machine) return
    setTimeout(() => {
      if (!this.machine) return
      try {
        const events = batch === 2
          ? this.machine.dealBatch2()
          : this.machine.dealBatch3()
        if (events.length > 0) this.dispatchEvents(events)
      } catch (err) {
        console.error('[GameRoom] dealBatch error:', err)
      }
    }, delayMs)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private broadcastToRoom(event: string, payload: Record<string, unknown>): void {
    this.io.to(this.roomId).emit(event, payload)
  }

  private emitError(playerId: string, err: unknown): void {
    const message = err instanceof Error ? err.message : 'UNKNOWN_ERROR'
    this.sockets.get(playerId)?.emit('game_error', { error: message })
  }

  /** Replace slots (called before auto-start so we have the full populated list) */
  updateSlots(slots: RoomSlot[]): void {
    this.slots = slots
  }

  /**
   * Send the current game snapshot directly to one socket.
   * Used by request_game_state — game page asks for state on mount.
   */
  sendStateTo(socket: Socket, playerId: string): void {
    // Make sure their socket is registered and in the channel
    const slot = this.slots.find(s => s.playerId === playerId)
    if (!slot) { socket.emit('game_error', { message: 'Not in this room' }); return }
    this.sockets.set(playerId, socket)
    socket.join(this.roomId)

    if (this.machine) {
      socket.emit('game_state', this.machine.getSnapshot())
      socket.emit('hand_update', { hand: this.machine.getHandFor(playerId) })
    }
    // If machine not started yet, client will receive game_state when startGame() fires
  }

  /** Start the next round (called after round_over when a player clicks Play Again) */
  startNextRound(): void {
    if (!this.machine) return
    // Alternate dealing team each round
    this.dealingTeam = this.dealingTeam === 'A' ? 'B' : 'A'
    const events = this.machine.startRound(this.dealingTeam)
    this.dispatchEvents(events)
  }

  isPlayerInRoom(playerId: string): boolean {
    return this.slots.some(s => s.playerId === playerId)
  }
}
