'use client'
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuthStore } from '@/store/auth.store'
import { useGameStore } from '@/store/game.store'
import { useGameSocket } from '@/hooks/useGameSocket'
import PlayingCard from '@/components/game/PlayingCard'
import ScoreBoard from '@/components/game/ScoreBoard'
import ColorCallOverlay from '@/components/game/ColorCallOverlay'
import HiddenRungPicker from '@/components/game/HiddenRungPicker'
import RoundOverlay from '@/components/game/RoundOverlay'
import TossOverlay from '@/components/game/TossOverlay'
import CardPlayNotification from '@/components/game/CardPlayNotification'
import DealingAnimation from '@/components/game/DealingAnimation'
import ShuffleDealer from '@/components/game/ShuffleDealer'
import RungRevealAnnouncement from '@/components/game/RungRevealAnnouncement'
import { Card, TrickCard } from '@/types/game.types'
import type { TrickLayer } from '@/components/game/GameTable2D'
import Spinner from '@/components/ui/Spinner'
import GameTable2D from '@/components/game/GameTable2D'

// ── Constants ────────────────────────────────────────────────────────────────
const SUIT_SYM: Record<string, string> = { spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣' }
const SUIT_CLR: Record<string, string> = {
  spades:'text-white', hearts:'text-red-400', diamonds:'text-red-400', clubs:'text-white',
}

// Server position (0–3) → screen seat (0=South/me, 1=East, 2=North, 3=West)
const S2S: Record<number, number> = { 0:0, 1:3, 2:2, 3:1 }
const SEAT_NAME: Record<number, string> = { 0:'South', 1:'East', 2:'North', 3:'West' }

// ── PlayerChip — reusable player avatar panel ─────────────────────────────────
function PlayerChip({
  name, seat, team, teamColor, isLead, hasPlayed, cardCount, face, horizontal = false,
}: {
  name: string; seat: string; team: string; teamColor: string
  isLead: boolean; hasPlayed: boolean; cardCount: number; face: string; horizontal?: boolean
}) {
  const teamGrad = team === 'A'
    ? 'linear-gradient(135deg,#0e4a5e 0%,#0e7490 100%)'
    : 'linear-gradient(135deg,#7c2d12 0%,#c2410c 100%)'

  const avatar = (
    <div style={{
      width: 44, height: 44, borderRadius: '50%', flexShrink: 0, position:'relative',
      background: teamGrad,
      border: isLead ? `2.5px solid ${teamColor}` : '1.5px solid rgba(255,255,255,0.12)',
      boxShadow: isLead
        ? `0 0 18px ${teamColor}88, 0 4px 12px rgba(0,0,0,0.6)`
        : '0 4px 12px rgba(0,0,0,0.55)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: 22,
    }}>
      {face}
      {hasPlayed && (
        <div style={{
          position:'absolute', bottom:-1, right:-1,
          width:14, height:14, borderRadius:'50%',
          background:'#16a34a', border:'1.5px solid #000',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:8, color:'#fff', fontWeight:700,
        }}>✓</div>
      )}
    </div>
  )

  const label = (
    <div style={{
      background: isLead
        ? 'linear-gradient(135deg,rgba(100,60,0,0.95),rgba(70,35,0,0.95))'
        : 'rgba(5,3,15,0.82)',
      backdropFilter: 'blur(12px)',
      border: isLead ? `1px solid ${teamColor}55` : '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '5px 10px',
      boxShadow: isLead ? `0 0 16px ${teamColor}44` : '0 4px 16px rgba(0,0,0,0.5)',
      minWidth: 80,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: isLead ? '#fde68a' : '#f1f5f9', whiteSpace:'nowrap' }}>
        {isLead ? '⭐ ' : ''}{name}
      </div>
      <div style={{ fontSize: 10, color:'rgba(255,255,255,0.4)', marginTop:1, display:'flex', gap:4, alignItems:'center' }}>
        <span>{seat} · T{team}</span>
        {cardCount > 0 && <span style={{ color:'rgba(255,255,255,0.25)' }}>🂠{cardCount}</span>}
        {isLead && <span style={{ color: teamColor, fontWeight:600 }}>leads</span>}
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection: horizontal ? 'row' : 'column', alignItems:'center', gap: 6 }}>
      {avatar}
      {label}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GameTablePage() {
  const { roomId } = useParams<{ roomId: string }>()
  const router     = useRouter()
  const { user }   = useAuthStore()

  const {
    state, myHand, reset,
    tossResult, colorCaller, lastCardPlayed,
    hiddenRungCard, rungRevealInfo,
    lastTrick, dealQueue, gameError, roundOverInfo,
    presence,
    setTossResult, setLastCardPlayed, setRungRevealInfo, popDealBatch,
  } = useGameStore()

  const { playCard, dealCards, selectHiddenRung, callColor, passColorCall, startNextRound } =
    useGameSocket(roomId, user?.id ?? '')

  // ── Auth guard (redirect if logged out) ────────────────────────────────
  useEffect(() => { if (!user) router.push('/') }, [user, router])

  // ── Reset store on unmount only (separate from auth guard) ─────────────
  // Keeping reset() in the auth guard caused it to fire every time the user
  // object reference changed, wiping game state and showing "Connecting…"
  useEffect(() => { return () => reset() }, [reset])

  // ── Toss overlay ─────────────────────────────────────────────────────────
  const [showToss, setShowToss]     = useState(false)
  const shownTossKey                = useRef('')
  const dismissToss = useCallback(() => { setShowToss(false); setTossResult(null) }, [setTossResult])

  useEffect(() => {
    const result = tossResult ?? state?.tossResult
    if (!result) return
    const key = result.tossCards.map(tc => tc.playerId + tc.card.rank + tc.card.suit).join('|')
    if (key === shownTossKey.current) return
    shownTossKey.current = key
    if (!tossResult) setTossResult(result as any)
    setShowToss(true)
  }, [tossResult, state?.tossResult]) // eslint-disable-line

  // ── Deal animation queue — pop one at a time ─────────────────────────────
  const [currentDeal, setCurrentDeal] = useState<typeof dealQueue[0] | null>(null)
  const dealingRef = useRef(false)

  useEffect(() => {
    if (dealingRef.current || dealQueue.length === 0) return
    dealingRef.current = true
    setCurrentDeal(dealQueue[0])
  }, [dealQueue])

  const handleDealComplete = useCallback(() => {
    setCurrentDeal(null)
    popDealBatch()
    dealingRef.current = false
  }, [popDealBatch])

  // ── Card play notification ────────────────────────────────────────────────
  const [activeNotif, setActiveNotif]   = useState<typeof lastCardPlayed>(null)
  const notifTimer                      = useRef<ReturnType<typeof setTimeout>|null>(null)

  useEffect(() => {
    if (!lastCardPlayed) return
    setActiveNotif(lastCardPlayed)
    if (notifTimer.current) clearTimeout(notifTimer.current)
    notifTimer.current = setTimeout(() => {
      setActiveNotif(null); setLastCardPlayed(null)
    }, 1800)
  }, [lastCardPlayed, setLastCardPlayed])

  // ── Rung reveal overlay (full-screen announcement) ───────────────────────
  const [showRungRevealOverlay, setShowRungRevealOverlay] = useState(false)
  const [showRungReveal, setShowRungReveal]               = useState(false)
  const shownRungRevealKey                                = useRef('')

  useEffect(() => {
    if (!rungRevealInfo) return
    // Deduplicate by card+trick
    const key = `${rungRevealInfo.card.rank}${rungRevealInfo.card.suit}${rungRevealInfo.trickNumber}`
    if (key === shownRungRevealKey.current) return
    shownRungRevealKey.current = key
    // Show full-screen overlay first
    setShowRungRevealOverlay(true)
    // After overlay hides, keep the persistent banner for a while
    const bannerTimer = setTimeout(() => setShowRungReveal(true), 4600)
    const clearTimer  = setTimeout(() => { setShowRungReveal(false); setRungRevealInfo(null) }, 10000)
    return () => { clearTimeout(bannerTimer); clearTimeout(clearTimer) }
  }, [rungRevealInfo, setRungRevealInfo])

  // ── Trick winner banner ───────────────────────────────────────────────────
  const [showTrickBanner, setShowTrickBanner] = useState(false)
  const prevTrickRef = useRef<typeof lastTrick>(null)
  useEffect(() => {
    if (!lastTrick || lastTrick === prevTrickRef.current) return
    prevTrickRef.current = lastTrick
    setShowTrickBanner(true)
    const t = setTimeout(() => setShowTrickBanner(false), 3200)
    return () => clearTimeout(t)
  }, [lastTrick])

  // ── Permanent table cards ─────────────────────────────────────────────────
  // Cards NEVER disappear. We keep every played trick as a layer.
  // Structure: trickHistory[i] = { cards, winnerId } for trick i
  // Current trick from state.currentTrick is the live top layer.
  // On new round, history resets.
  const [trickHistory, setTrickHistory] = useState<TrickLayer[]>([])
  const lastTrickNumRef = useRef<number>(0)

  // Reset history when a new round starts (trickNumber resets to 1)
  useEffect(() => {
    if (!state) return
    if (state.phase === 'playing' && state.trickNumber === 1 && state.currentTrick.length === 0) {
      setTrickHistory([])
      lastTrickNumRef.current = 0
    }
  }, [state?.phase, state?.trickNumber])

  // When a trick completes, push it to history (keyed by trickNumber to avoid dups)
  useEffect(() => {
    if (!lastTrick) return
    if (lastTrick.trickNumber <= lastTrickNumRef.current) return
    lastTrickNumRef.current = lastTrick.trickNumber
    setTrickHistory(prev => [
      ...prev,
      { cards: lastTrick.cards, winnerId: lastTrick.winnerId },
    ])
  }, [lastTrick])

  // ── AI auto-deal (when no human on dealing team) ──────────────────────────
  useEffect(() => {
    if (state?.phase !== 'awaiting_deal') return
    const humanDealer = (state.players ?? []).some(
      p => p.type === 'human' && p.team === state.dealingTeam
    )
    if (humanDealer) return
    const t = setTimeout(() => dealCards(), 1800)
    return () => clearTimeout(t)
  }, [state?.phase, state?.dealingTeam]) // eslint-disable-line

  // ── Player maps ───────────────────────────────────────────────────────────
  const playerMap = useMemo(() =>
    Object.fromEntries((state?.players ?? []).map(p => [p.id, p])),
    [state?.players]
  )

  const playerNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const p of (state?.players ?? [])) {
      const screen = S2S[p.position] ?? p.position
      names[p.id] = p.id === user?.id
        ? (user?.displayName ?? 'You')
        : (p.displayName ?? SEAT_NAME[screen] ?? `P${p.position}`)
    }
    return names
  }, [state?.players, user])

  const playerPositions = useMemo(() => {
    const pos: Record<string, number> = {}
    for (const p of (state?.players ?? [])) pos[p.id] = p.position
    return pos
  }, [state?.players])

  // ── Hand sorting — group by suit (♠♥♦♣), within suit ascending rank ───────
  const SUIT_ORDER: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 }
  const RANK_ORDER: Record<string, number> = {
    '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,
  }
  const sortedHand = useMemo(() =>
    [...myHand].sort((a, b) => {
      const sd = (SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0)
      return sd !== 0 ? sd : (RANK_ORDER[a.rank] ?? 0) - (RANK_ORDER[b.rank] ?? 0)
    }),
    [myHand] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ── Turn / role flags ─────────────────────────────────────────────────────
  const isMyTurn = useMemo(() => {
    if (!state || state.phase !== 'playing') return false
    if (state.currentTrick.length === 0) return state.leadPlayerId === user?.id
    return !state.currentTrick.some(tc => tc.playerId === user?.id)
  }, [state, user])

  const isRungHolder = state?.rungHolderId === user?.id
  const myTeam       = (state?.players ?? []).find(p => p.id === user?.id)?.team ?? 'A'

  const isMyDealingTurn = state?.phase === 'awaiting_deal' &&
    (state.players ?? []).some(p => p.id === user?.id && p.team === state.dealingTeam)

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!state) {
    return (
      <div className="min-h-screen felt-table flex items-center justify-center">
        <Spinner size="lg" />
        <p className="text-white/60 mt-4 text-sm">Connecting to game…</p>
      </div>
    )
  }

  const aiPlayers      = (state.players ?? []).filter(p => p.id !== user?.id)
  // roundOverInfo lives in its own Zustand field — never overwritten by game_state events

  // Trick winner context string
  const trickWinnerName = lastTrick ? (lastTrick.winnerId === user?.id ? 'You' : (playerNames[lastTrick.winnerId] ?? '?')) : ''
  const trickConsec = lastTrick
    ? (lastTrick.winnerTeam === 'A' ? lastTrick.consecutiveA : lastTrick.consecutiveB)
    : 0

  // Rung reveal player name
  const revealerName = rungRevealInfo
    ? (rungRevealInfo.triggeredBy === user?.id ? 'You' : (playerNames[rungRevealInfo.triggeredBy] ?? 'A player'))
    : ''

  return (
    <div className="flex flex-col select-none" style={{
      height: '100dvh', overflow: 'hidden',
      background: 'radial-gradient(ellipse at 30% 0%, #2d0a5e 0%, transparent 50%), radial-gradient(ellipse at 70% 0%, #0a1a5e 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, #3d1a00 0%, transparent 45%), linear-gradient(180deg, #0e0820 0%, #060412 60%, #030209 100%)',
    }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-1.5 shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 0 rgba(180,130,255,0.08)',
      }}>
        {/* Exit */}
        <button onClick={() => router.push('/lobby')} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '5px 14px', color: 'rgba(255,255,255,0.5)',
          fontSize: 12, cursor: 'pointer', transition: 'all 0.2s', fontWeight: 500,
        }}
          onMouseEnter={e => {(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'}}
          onMouseLeave={e => {(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'}}
        >← Exit</button>

        {/* Centre branding + phase */}
        <div style={{ textAlign:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, justifyContent:'center' }}>
            <span style={{ fontSize: 14, letterSpacing: '2px', fontWeight: 800, color: '#c084fc', textTransform:'uppercase' }}>Band Rang</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1, letterSpacing: '0.5px', textTransform:'uppercase' }}>
            {state.phase.replace(/_/g, ' ')}
          </div>
        </div>

        {/* Player info + trump */}
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          {state.trumpRevealed && state.trumpSuit && (() => {
            const isRed = state.trumpSuit === 'hearts' || state.trumpSuit === 'diamonds'
            const suitClr = isRed ? '#f87171' : '#e2e8f0'
            const rc = rungRevealInfo?.card
            return (
              <div style={{
                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 8, padding: '3px 10px',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {/* Scenario A: show rank + suit (e.g. "K♠") */}
                {state.scenario === 'A' && rc ? (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'Georgia, serif', color: suitClr }}>
                      {rc.rank}
                    </span>
                    <span style={{ fontSize: 13, color: suitClr }}>{SUIT_SYM[state.trumpSuit]}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>rung</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 13, color: suitClr }}>{SUIT_SYM[state.trumpSuit]}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>trump</span>
                  </>
                )}
              </div>
            )
          })()}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{user?.displayName}</div>
        </div>
      </div>

      {/* ── Notification banners ──────────────────────────────────────────── */}
      <div className="shrink-0" style={{ position:'relative', zIndex: 20 }}>

        {colorCaller && state.phase === 'playing' && state.trumpRevealed && (
          <div style={{ background:'linear-gradient(90deg,rgba(120,53,0,0.95),rgba(92,40,0,0.95))', borderBottom:'1px solid rgba(245,158,11,0.3)', padding:'5px 20px', textAlign:'center', fontSize: 12 }}>
            🎨{' '}
            <span style={{ color:'#fde68a', fontWeight: 700 }}>{colorCaller.callerId === user?.id ? 'You' : playerNames[colorCaller.callerId]}</span>
            {' '}called{' '}
            <span style={{ color: colorCaller.suit === 'hearts' || colorCaller.suit === 'diamonds' ? '#fca5a5' : '#e2e8f0', fontWeight: 700 }}>{SUIT_SYM[colorCaller.suit]} {colorCaller.suit}</span>
            {' '}as trump!
          </div>
        )}

        {showRungReveal && rungRevealInfo && (
          <div style={{ background:'linear-gradient(90deg,rgba(7,24,80,0.97),rgba(5,15,60,0.97))', borderBottom:'1px solid rgba(96,165,250,0.3)', padding:'5px 20px', textAlign:'center' }} className="animate-slide-up">
            <span style={{ color:'#93c5fd', fontWeight: 700, fontSize: 13 }}>🃏 Rung Revealed! </span>
            <span style={{ color:'rgba(147,197,253,0.7)', fontSize: 12 }}>
              {revealerName} triggered it —{' '}
              <span style={{ color: rungRevealInfo.suit === 'hearts' || rungRevealInfo.suit === 'diamonds' ? '#fca5a5' : '#e2e8f0', fontWeight: 700 }}>
                {rungRevealInfo.card.rank}{SUIT_SYM[rungRevealInfo.suit]}
              </span>
              {' '}is now trump
            </span>
          </div>
        )}

        {gameError && (
          <div style={{ background:'linear-gradient(90deg,rgba(80,7,7,0.97),rgba(60,5,5,0.97))', borderBottom:'1px solid rgba(239,68,68,0.3)', padding:'5px 20px', textAlign:'center', fontSize: 12, color:'#fca5a5', fontWeight: 600 }} className="animate-slide-up">
            {gameError === 'MUST_PLAY_TRUMP' ? '🃏 Must play Trump! The hidden rung was just revealed.' : `⚠️ ${gameError}`}
          </div>
        )}

        {showTrickBanner && lastTrick && (
          <div style={{
            background: lastTrick.winnerTeam === myTeam
              ? 'linear-gradient(90deg,rgba(5,40,15,0.97),rgba(3,28,10,0.97))'
              : 'linear-gradient(90deg,rgba(20,20,30,0.97),rgba(12,12,22,0.97))',
            borderBottom: `1px solid ${lastTrick.winnerTeam === myTeam ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.3)'}`,
            padding:'5px 20px', textAlign:'center',
          }} className="animate-slide-up">
            <span style={{ color: lastTrick.winnerTeam === myTeam ? '#86efac' : '#94a3b8', fontWeight: 700, fontSize: 12 }}>
              🏆 Trick {lastTrick.trickNumber} — {trickWinnerName}
            </span>
            <span style={{ color:'rgba(255,255,255,0.4)', fontSize: 12 }}>{' '}won with </span>
            <span style={{ color: lastTrick.winningCard.suit === 'hearts' || lastTrick.winningCard.suit === 'diamonds' ? '#fca5a5' : '#e2e8f0', fontWeight: 700, fontSize: 13 }}>
              {lastTrick.winningCard.rank}{SUIT_SYM[lastTrick.winningCard.suit]}
            </span>
            {trickConsec >= 2 && (
              <span style={{ color:'#fbbf24', fontSize: 11, marginLeft: 8 }}>⚡ {trickConsec} in a row!</span>
            )}
          </div>
        )}
      </div>

      {/* ── Main table area ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', flex:1, gap: 8, padding: '6px 8px 0', overflow:'hidden', minHeight: 0 }}>

        {/* Scoreboard — left side panel */}
        <div style={{ display:'none' }} className="lg:flex flex-col justify-center shrink-0">
          <ScoreBoard state={state} myTeam={myTeam} rungCard={rungRevealInfo?.card ?? null} />
        </div>

        {/* ── Table + cards column ─────────────────────────────────────────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight: 0, gap: 0, position:'relative' }}>

          {/* ── Poker table area ─────────────────────────────────────────── */}
          <div style={{
            flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden',
            background: 'linear-gradient(180deg, #05030f 0%, #030108 100%)',
          }}>

            {/* 2D poker table — North/East/West players + played cards rendered inside */}
            <GameTable2D
              currentTrick={state.currentTrick}
              trickHistory={trickHistory}
              aiPlayers={aiPlayers}
              playerMap={playerMap}
              state={state}
              userId={user?.id ?? ''}
              isMyTurn={isMyTurn}
              lastTrick={lastTrick ?? null}
              hiddenRungCard={hiddenRungCard}
              rungRevealCard={rungRevealInfo?.card ?? null}
              presence={presence}
            />

            {/* ── Disconnection banner ─────────────────────────────────── */}
            {(() => {
              const disconnectedHumans = (state.players ?? []).filter(p =>
                p.type === 'human' && p.id !== user?.id && presence[p.id] === 'disconnected'
              )
              if (disconnectedHumans.length === 0) return null
              return (
                <div style={{
                  position: 'absolute', bottom: 8, left: '50%',
                  transform: 'translateX(-50%)', zIndex: 40,
                  background: 'rgba(127,29,29,0.97)',
                  border: '1px solid rgba(239,68,68,0.5)',
                  borderRadius: 12, padding: '8px 20px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ fontSize: 16 }}>📵</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5' }}>
                      {disconnectedHumans.map(p => playerNames[p.id] ?? 'A player').join(', ')} disconnected
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(252,165,165,0.6)', marginTop: 1 }}>
                      Waiting for them to rejoin… (90s grace period)
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Trick badge */}
            {state.phase === 'playing' && (
              <div style={{ position:'absolute', top:8, right:10, zIndex:20, pointerEvents:'none' }}>
                <div style={{ background:'rgba(0,0,0,0.65)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'3px 12px', fontSize:11, color:'rgba(255,255,255,0.35)', backdropFilter:'blur(8px)', whiteSpace:'nowrap' }}>
                  Trick {state.trickNumber} / 13
                </div>
              </div>
            )}

            {/* Card play notification */}
            {activeNotif && (() => {
              const pp   = playerMap[activeNotif.playerId]
              const scrn = S2S[pp?.position ?? 0] ?? 0
              const isMe = activeNotif.playerId === user?.id
              return (
                <CardPlayNotification
                  key={`${activeNotif.trickNumber}-${activeNotif.playerId}`}
                  card={activeNotif.card}
                  playerName={isMe ? 'You' : (playerNames[activeNotif.playerId] ?? '?')}
                  screenPos={scrn}
                  isMe={isMe}
                />
              )
            })()}

            {/* Shuffle + Deal */}
            {state.phase === 'awaiting_deal' && isMyDealingTurn && !showToss && !currentDeal && (
              <div style={{ position:'absolute', inset:0, zIndex:30 }} className="pointer-events-auto">
                <ShuffleDealer dealingTeam={state.dealingTeam ?? 'A'} onDeal={dealCards} />
              </div>
            )}

            {/* Dealing animation */}
            {currentDeal && !showToss && (
              <DealingAnimation batch={currentDeal.batch} cardsPerPlayer={currentDeal.cardsPerPlayer} onComplete={handleDealComplete} />
            )}

            {/* Toss overlay */}
            {showToss && tossResult && (
              <TossOverlay toss={tossResult} playerPositions={playerPositions} playerNames={playerNames} myId={user?.id ?? ''} onDone={dismissToss} />
            )}

          </div>

          {/* ── South player strip + hand ────────────────────────────────── */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.9) 100%)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '6px 12px 8px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            flexShrink: 0,
          }}>

            {/* South player chip (above hand, touching table bottom) */}
            {(() => {
              const initial = (user?.displayName ?? 'P').charAt(0).toUpperCase()
              const isLeading = isMyTurn && state.phase === 'playing' && state.currentTrick.length === 0
              const hasPlayed = state.currentTrick.some(tc => tc.playerId === user?.id)
              const teamColor = myTeam === 'A' ? '#06b6d4' : '#f97316'
              return (
                <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0, position:'relative',
                    background: myTeam === 'A'
                      ? 'linear-gradient(135deg,#0e4a5e,#0891b2)'
                      : 'linear-gradient(135deg,#7c2d12,#ea580c)',
                    border: isLeading ? `2px solid ${teamColor}` : '1.5px solid rgba(255,255,255,0.15)',
                    boxShadow: isLeading ? `0 0 12px ${teamColor}66` : '0 2px 6px rgba(0,0,0,0.5)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif',
                  }}>
                    {initial}
                    {hasPlayed && <div style={{ position:'absolute', bottom:-2, right:-2, width:12, height:12, borderRadius:'50%', background:'#16a34a', border:'1.5px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, color:'#fff', fontWeight:700 }}>✓</div>}
                  </div>
                  {/* Info */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isLeading ? '#fde68a' : '#f1f5f9', letterSpacing:'0.2px' }}>
                      {isLeading ? '⭐ Your turn!' : (user?.displayName ?? 'You')}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                      South · Team {myTeam}
                      {myHand.length > 0 && <span style={{ marginLeft: 5, color:'rgba(255,255,255,0.25)' }}>🂠×{myHand.length}</span>}
                    </div>
                  </div>
                  {/* Your turn hint */}
                  {isMyTurn && state.phase === 'playing' && state.currentTrick.length > 0 && (
                    <div style={{
                      marginLeft: 6,
                      background: 'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.35)',
                      borderRadius: 20, padding: '2px 10px', fontSize: 10, color:'#fcd34d',
                      animation: 'pulse 1.5s infinite',
                    }}>
                      Play a card ↑
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Hand cards */}
            <div style={{ display:'flex', gap: 1, flexWrap:'nowrap', justifyContent:'center', alignItems:'flex-end', overflow:'hidden' }}>
              {sortedHand.map((card, i) => {
                const prevSuit = i > 0 ? sortedHand[i-1].suit : card.suit
                const suitBreak = i > 0 && card.suit !== prevSuit
                return (
                  <React.Fragment key={`${card.suit}${card.rank}${i}`}>
                    {suitBreak && <div style={{ width: 5, flexShrink: 0 }} />}
                    <div className="animate-deal-in" style={{ animationDelay: `${i * 20}ms` }}>
                      <PlayingCard
                        card={card}
                        disabled={!isMyTurn || state.phase !== 'playing'}
                        onClick={() => {
                          if (!isMyTurn || state.phase !== 'playing') return
                          playCard(card)
                        }}
                        size="sm"
                      />
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          </div>

        </div>

        {/* Scoreboard — right side (lg) */}
        <div className="hidden lg:flex flex-col justify-center shrink-0">
          <ScoreBoard state={state} myTeam={myTeam} rungCard={rungRevealInfo?.card ?? null} />
        </div>

      </div>

      {/* ── Full-screen overlays ──────────────────────────────────────────── */}

      {/* (TossOverlay is now rendered inside the 3D table container above) */}

      {/* Rung selection */}
      {state.phase === 'rung_selection' && isRungHolder && !showToss && !currentDeal && (
        <HiddenRungPicker hand={myHand} onSelect={selectHiddenRung} />
      )}

      {/* Color call */}
      {state.phase === 'color_call' && !currentDeal && (
        <ColorCallOverlay
          isRungHolder={isRungHolder}
          onCall={callColor}
          onPass={passColorCall}
        />
      )}

      {/* Rung reveal full-screen announcement */}
      {showRungRevealOverlay && rungRevealInfo && (
        <RungRevealAnnouncement
          card={rungRevealInfo.card}
          suit={rungRevealInfo.suit}
          triggeredBy={rungRevealInfo.triggeredBy}
          trickNumber={rungRevealInfo.trickNumber}
          playerNames={playerNames}
          onDismiss={() => setShowRungRevealOverlay(false)}
        />
      )}

      {/* Round over — uses dedicated roundOverInfo field (never overwritten by game_state) */}
      {roundOverInfo && state.phase === 'round_over' && (
        <RoundOverlay
          winnerTeam={roundOverInfo.winnerTeam}
          myTeam={myTeam}
          reason={roundOverInfo.reason}
          kothi={roundOverInfo.kothi}
          kothiCounter={roundOverInfo.kothiCounter}
          scenario={roundOverInfo.scenario}
          tricksPlayed={roundOverInfo.tricksPlayed || roundOverInfo.trickWins.length}
          trickWins={roundOverInfo.trickWins}
          consecutiveA={roundOverInfo.consecutiveA}
          consecutiveB={roundOverInfo.consecutiveB}
          callingTeam={roundOverInfo.callingTeam}
          rungHolderId={roundOverInfo.rungHolderId}
          rungRevealedOnTrick={roundOverInfo.rungRevealedOnTrick}
          playerNames={playerNames}
          onPlayAgain={startNextRound}
          onLobby={() => router.push('/lobby')}
        />
      )}
    </div>
  )
}
