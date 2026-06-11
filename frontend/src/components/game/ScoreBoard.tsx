import { Card, GameState } from '@/types/game.types'

const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
}
const SUIT_COLOR: Record<string, string> = {
  spades: '#e2e8f0', hearts: '#f87171', diamonds: '#fb923c', clubs: '#86efac',
}

export default function ScoreBoard({
  state, myTeam, rungCard,
}: {
  state: GameState
  myTeam: 'A' | 'B'
  rungCard?: Card | null
}) {
  const tricksA = state.trickWins.filter(t => t === 'A').length
  const tricksB = state.trickWins.filter(t => t === 'B').length

  return (
    <div style={{
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(14px)',
      borderRadius: 18,
      border: '1px solid rgba(255,255,255,0.08)',
      padding: '16px 14px',
      minWidth: 168,
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>

      {/* ── Trump (Rung) ── */}
      <div style={{ textAlign: 'center', paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          Trump (Rung)
        </div>

        {state.trumpRevealed && state.trumpSuit ? (
          <div>
            {/* Suit circle */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)',
              border: `2px solid ${SUIT_COLOR[state.trumpSuit]}55`,
              fontSize: 22, marginBottom: 6,
              boxShadow: `0 0 18px ${SUIT_COLOR[state.trumpSuit]}33`,
              color: SUIT_COLOR[state.trumpSuit],
            }}>
              {SUIT_SYMBOL[state.trumpSuit]}
            </div>

            {/* Suit name */}
            <div style={{ fontSize: 11, fontWeight: 700, color: SUIT_COLOR[state.trumpSuit], textTransform: 'capitalize', marginBottom: 2 }}>
              {state.trumpSuit}
            </div>

            {/* Revealed card (Scenario A only) */}
            {rungCard && state.scenario === 'A' && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${SUIT_COLOR[state.trumpSuit]}44`,
                borderRadius: 8, padding: '3px 10px', marginTop: 4,
              }}>
                <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'Georgia, serif', color: SUIT_COLOR[state.trumpSuit] }}>
                  {rungCard.rank}
                </span>
                <span style={{ fontSize: 13, color: SUIT_COLOR[state.trumpSuit] }}>
                  {SUIT_SYMBOL[state.trumpSuit]}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginLeft: 1 }}>
                  rung
                </span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, margin: '0 auto 6px',
            }}>
              🤫
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Hidden</div>
          </div>
        )}
      </div>

      {/* ── Scenario ── */}
      <div style={{ textAlign: 'center', paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Scenario</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>
          {state.scenario === 'A' ? '🔒 Hidden Rung' : state.scenario === 'B' ? '🌐 Open Rung' : '—'}
        </div>
      </div>

      {/* ── Trick number ── */}
      <div style={{ textAlign: 'center', paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Trick</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>
          {state.trickNumber}<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>/13</span>
        </div>
      </div>

      {/* ── Tricks won ── */}
      <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8, letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'center' }}>Tricks Won</div>
        {(['A', 'B'] as const).map(team => {
          const count = team === 'A' ? tricksA : tricksB
          const isMe  = team === myTeam
          return (
            <div key={team} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 5, fontSize: 11,
              color: isMe ? '#fde68a' : 'rgba(255,255,255,0.4)',
            }}>
              <span>Team {team}{isMe ? ' (You)' : ''}</span>
              <span style={{ fontWeight: 800, fontSize: 13 }}>{count}</span>
            </div>
          )
        })}
      </div>

      {/* ── Consecutive tricks ── */}
      <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8, letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'center' }}>Consecutive</div>
        {(['A', 'B'] as const).map(team => {
          const consec = team === 'A' ? state.consecutiveA : state.consecutiveB
          const isMe   = team === myTeam
          return (
            <div key={team} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 5,
            }}>
              <span style={{ fontSize: 11, color: isMe ? '#fde68a' : 'rgba(255,255,255,0.4)' }}>
                T{team}
              </span>
              <div style={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: i < consec
                      ? (isMe ? '#f59e0b' : 'rgba(255,255,255,0.4)')
                      : 'rgba(255,255,255,0.08)',
                  }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Kothi counter ── */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Kothi</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
          {Array.from({ length: 7 }).map((_, i) => {
            const val    = i - 3
            const active = state.kothiCounter !== 0 &&
              ((state.kothiCounter > 0 && val > 0 && val <= state.kothiCounter) ||
               (state.kothiCounter < 0 && val < 0 && val >= state.kothiCounter))
            return (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%',
                background: val === 0
                  ? 'rgba(255,255,255,0.25)'
                  : active
                    ? (state.kothiCounter > 0 ? '#ef4444' : '#3b82f6')
                    : 'rgba(255,255,255,0.08)',
              }} />
            )
          })}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{state.kothiCounter}</div>
      </div>
    </div>
  )
}
