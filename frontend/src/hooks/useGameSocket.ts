'use client'
import { useEffect, useCallback } from 'react'
import { connectSocket } from '@/services/socket.service'
import { useGameStore, DealBatch } from '@/store/game.store'
import { Card, GameState, Suit, TrickCard, Team } from '@/types/game.types'

export function useGameSocket(roomId: string, playerId: string) {
  const {
    setState, setHand, setLastEvent,
    setTossResult, setColorCaller, setLastCardPlayed,
    setRungRevealInfo, setLastTrick, pushDealBatch, setGameError, setRoundOverInfo,
    setPresence,
  } = useGameStore()

  useEffect(() => {
    if (!roomId || !playerId) return
    const socket = connectSocket()

    socket.on('game_state', (data: GameState & { presence?: Record<string, 'connected'|'disconnected'> }) => {
      const { presence, ...gameState } = data as any
      setState(gameState)
      if (data.tossResult) setTossResult(data.tossResult as any)
      if (presence) setPresence(presence)
      // NOTE: intentionally does NOT touch roundOverInfo — it lives in its own field
    })
    socket.on('hand_update', ({ hand }: { hand: Card[] }) => setHand(hand))

    socket.on('toss_result', (data: {
      tossCards: { playerId: string; card: Card }[]
      winnerPlayerId: string; winnerTeam: 'A' | 'B'
    }) => {
      setTossResult(data)
      setLastEvent('toss_result')
    })

    socket.on('awaiting_deal', () => setLastEvent('awaiting_deal'))

    // ── Deal batch animation queue ─────────────────────────────────────────────
    socket.on('batch_dealt', (data: { batch: 1|2|3; cardsPerPlayer: number }) => {
      pushDealBatch(data as DealBatch)
      setLastEvent(`batch_dealt_${data.batch}`)
    })

    socket.on('color_called', ({ callerId, suit }: { callerId: string; suit: string }) => {
      setColorCaller({ callerId, suit })
      setLastEvent('color_called')
    })

    socket.on('card_played', (data: { playerId: string; card: Card; trickNumber: number }) => {
      setLastCardPlayed(data)
      setLastEvent('card_played')
    })

    socket.on('trick_complete', (data: {
      trickNumber: number; winner: string; winnerTeam: Team; winningCard: Card
      cards: TrickCard[]; consecutiveA: number; consecutiveB: number
    }) => {
      setLastTrick({
        trickNumber:  data.trickNumber,
        winnerId:     data.winner,
        winnerTeam:   data.winnerTeam,
        winningCard:  data.winningCard,
        cards:        data.cards,
        consecutiveA: data.consecutiveA,
        consecutiveB: data.consecutiveB,
      })
      setLastEvent('trick_complete')
    })

    socket.on('rung_revealed', (data: {
      card: Card; suit: string; triggeredBy: string; trickNumber: number
    }) => {
      setRungRevealInfo(data)
      setLastEvent('rung_revealed')
    })

    socket.on('next_trick',  () => setLastEvent('next_trick'))

    socket.on('round_over', (data: any) => {
      // Store round_over data in its own dedicated field so game_state can never overwrite it
      setRoundOverInfo({
        winnerTeam:          data.winnerTeam,
        loserTeam:           data.loserTeam,
        reason:              data.reason,
        kothi:               data.kothi ?? null,
        kothiCounter:        data.kothiCounter ?? 0,
        trickWins:           data.trickWins ?? [],
        tricksPlayed:        data.tricksPlayed ?? data.trickWins?.length ?? 0,
        consecutiveA:        data.consecutiveA ?? 0,
        consecutiveB:        data.consecutiveB ?? 0,
        scenario:            data.scenario ?? null,
        callingTeam:         data.callingTeam ?? null,
        rungHolderId:        data.rungHolderId ?? null,
        rungRevealedOnTrick: data.rungRevealedOnTrick ?? null,
      })
      // Also update the game state phase so UI knows to show the overlay
      setState((s: GameState | null) => s ? { ...s, phase: 'round_over' } : s)
      setLastEvent('round_over')
    })

    // ── Player presence ────────────────────────────────────────────────────────
    socket.on('player_disconnected', (data: { playerId: string; displayName: string; presence: Record<string, 'connected'|'disconnected'>; gracePeriodMs: number }) => {
      setPresence(data.presence)
      setLastEvent('player_disconnected')
    })

    socket.on('player_reconnected', (data: { playerId: string; displayName: string; presence: Record<string, 'connected'|'disconnected'> }) => {
      setPresence(data.presence)
      setLastEvent('player_reconnected')
    })

    socket.on('player_connected', (data: { playerId: string; presence: Record<string, 'connected'|'disconnected'> }) => {
      if (data.presence) setPresence(data.presence)
    })

    socket.on('game_error', ({ error }: { error: string }) => {
      console.error('[GameSocket]', error)
      setGameError(error)
      setLastEvent(`error:${error}`)
      // Auto-clear non-critical errors after 3s
      setTimeout(() => setGameError(null), 3000)
    })

    socket.emit('join_room', { roomId })

    // Safety fallback: if no game_state received within 4s, re-join
    const retryTimer = setTimeout(() => {
      const { state } = useGameStore.getState()
      if (!state) {
        console.warn('[useGameSocket] No game_state after 4s — retrying join_room')
        socket.emit('join_room', { roomId })
      }
    }, 4000)

    return () => {
      clearTimeout(retryTimer)
      socket.off('game_state'); socket.off('hand_update')
      socket.off('toss_result'); socket.off('awaiting_deal')
      socket.off('batch_dealt'); socket.off('color_called')
      socket.off('card_played'); socket.off('trick_complete')
      socket.off('rung_revealed'); socket.off('next_trick')
      socket.off('round_over'); socket.off('game_error')
      socket.off('player_disconnected'); socket.off('player_reconnected')
      socket.off('player_connected')
    }
  }, [roomId, playerId, setState, setHand, setLastEvent, setTossResult, setColorCaller,
      setLastCardPlayed, setRungRevealInfo, setLastTrick, pushDealBatch, setGameError,
      setRoundOverInfo, setPresence])

  const playCard       = useCallback((card: Card) =>
    connectSocket().emit('play_card', { roomId, card }), [roomId])

  const dealCards      = useCallback(() =>
    connectSocket().emit('deal_cards', { roomId }), [roomId])

  const selectHiddenRung = useCallback((card: Card) =>
    connectSocket().emit('select_hidden_rung', { roomId, card }), [roomId])

  const callColor      = useCallback((suit: Suit) =>
    connectSocket().emit('call_color', { roomId, suit }), [roomId])

  const passColorCall  = useCallback(() =>
    connectSocket().emit('pass_color_call', { roomId }), [roomId])

  const startNextRound = useCallback(() =>
    connectSocket().emit('next_round', { roomId }), [roomId])

  return { playCard, dealCards, selectHiddenRung, callColor, passColorCall, startNextRound }
}
