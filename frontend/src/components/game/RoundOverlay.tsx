'use client'

interface Props {
  winnerTeam:         'A' | 'B'
  myTeam:             'A' | 'B'
  reason:             string
  kothi:              'A' | 'B' | null
  kothiCounter:       number
  // detailed context for the explanation panel
  scenario:           'A' | 'B' | null
  tricksPlayed:       number
  trickWins:          Array<'A' | 'B'>
  consecutiveA:       number
  consecutiveB:       number
  callingTeam:        'A' | 'B' | null
  rungHolderId:       string | null
  rungRevealedOnTrick: number | null
  playerNames:        Record<string, string>   // playerId → display name
  onPlayAgain:        () => void
  onLobby:            () => void
}

// ── Reason titles ─────────────────────────────────────────────────────────────
const REASON_TITLE: Record<string, string> = {
  rung_holder_consecutive: '2 Consecutive Tricks (Rung Holder)',
  opponent_consecutive:    '2 Consecutive Tricks (After Reveal)',
  non_calling_consecutive: '2 Consecutive Tricks (Non-Calling)',
  calling_team_survives:   'Calling Team Survived All 13 Tricks',
  trick_13_fallback:       'Won the Final Trick (Trick 13)',
  revoke:                  'Revoke — Foul Play',
}

// ── Build a plain-English explanation ─────────────────────────────────────────
function buildExplanation(props: Props): string[] {
  const {
    reason, winnerTeam, scenario, tricksPlayed,
    trickWins, consecutiveA, consecutiveB,
    callingTeam, rungHolderId, rungRevealedOnTrick, playerNames,
  } = props

  const lines: string[] = []

  const tricksCount = tricksPlayed || trickWins.length

  // Scenario label + rung holder info
  if (scenario === 'A') {
    const rungHolderName = rungHolderId ? (playerNames[rungHolderId] ?? rungHolderId) : '?'
    lines.push(`Mode: Hidden Rung (Band Rang)`)
    lines.push(`Rung Holder: ${rungHolderName}`)
  } else if (scenario === 'B') {
    lines.push(`Mode: Open Rung — Team ${callingTeam} called the color`)
  }

  // Trick history summary
  const winsA = trickWins.filter(t => t === 'A').length
  const winsB = trickWins.filter(t => t === 'B').length
  lines.push(`Tricks played: ${tricksCount}  |  Team A: ${winsA}  |  Team B: ${winsB}`)

  // Consecutive at end
  lines.push(`Consecutive at end → Team A: ${consecutiveA}, Team B: ${consecutiveB}`)

  // Raw reason code (always show for debugging)
  lines.push(`Win reason code: "${reason}"`)

  // Reveal info (Scenario A)
  if (scenario === 'A') {
    if (rungRevealedOnTrick) {
      lines.push(`Rung revealed on trick ${rungRevealedOnTrick}`)
    } else {
      lines.push('Rung was NEVER revealed')
    }
  }

  // Reason-specific explanation
  switch (reason) {
    case 'rung_holder_consecutive':
      lines.push(
        `Team ${winnerTeam} is the Rung Holder.`,
        `They won 2 tricks in a row ending on trick ${tricksCount} (≥ trick 9 required).`,
        `→ Rung Holder wins with 2 consecutive from trick 8+.`
      )
      break
    case 'opponent_consecutive': {
      const minEnd = rungRevealedOnTrick ? Math.max(4, rungRevealedOnTrick + 1) : 4
      lines.push(
        `Team ${winnerTeam} is the Opponent (non-Rung-Holder).`,
        `They won 2 tricks in a row ending on trick ${tricksCount}.`,
        `After reveal on trick ${rungRevealedOnTrick}, earliest winning pair ends at trick ${minEnd}.`,
        `→ Opponent wins with 2 consecutive after the reveal.`
      )
      break
    }
    case 'non_calling_consecutive':
      lines.push(
        `Team ${winnerTeam} did NOT call the color.`,
        `They won 2 tricks in a row ending on trick ${tricksCount} (≥ trick 3 required).`,
        `→ Non-calling team wins with 2 consecutive from trick 2+.`
      )
      break
    case 'calling_team_survives':
      lines.push(
        `Team ${callingTeam} called the color.`,
        `All 13 tricks were played and the non-calling team never got 2 in a row.`,
        `→ Calling team wins by surviving the full round.`
      )
      break
    case 'trick_13_fallback':
      lines.push(
        `All 13 tricks were played.`,
        `No consecutive-win condition was met before trick 13.`,
        `Team ${winnerTeam} won the last trick → they win the round.`
      )
      break
    case 'revoke':
      lines.push(
        `A player played a card that did not follow the led suit`,
        `and was not a valid trump — this is a Revoke (foul play).`,
        `→ The opposing team wins automatically.`
      )
      break
  }

  return lines
}

// ── Trick timeline bar ────────────────────────────────────────────────────────
function TrickBar({ trickWins, myTeam }: { trickWins: Array<'A' | 'B'>; myTeam: 'A' | 'B' }) {
  return (
    <div className="flex gap-0.5 mt-1">
      {trickWins.map((winner, i) => (
        <div
          key={i}
          title={`Trick ${i + 1}: Team ${winner}`}
          className={`flex-1 h-5 rounded-sm text-[9px] font-bold flex items-center justify-center
            ${winner === myTeam
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-700 text-white'}`}
        >
          {i + 1}
        </div>
      ))}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RoundOverlay(props: Props) {
  const {
    winnerTeam, myTeam, reason, kothi, kothiCounter,
    trickWins, onPlayAgain, onLobby,
  } = props

  const iWon  = winnerTeam === myTeam
  const lines = buildExplanation(props)
  const title = REASON_TITLE[reason] || reason

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-sm w-full
                      mx-4 shadow-2xl text-center">

        {/* Result emoji + headline */}
        <div className="text-5xl mb-3">{iWon ? '🎉' : '😔'}</div>
        <h2 className={`text-2xl font-bold mb-1 ${iWon ? 'text-yellow-400' : 'text-slate-400'}`}>
          {iWon ? 'Your Team Won!' : 'Your Team Lost'}
        </h2>
        <p className="text-slate-400 text-sm mb-1">Team {winnerTeam} wins this round</p>

        {/* Win reason title */}
        <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4
          ${iWon ? 'bg-yellow-900/60 text-yellow-300' : 'bg-rose-900/60 text-rose-300'}`}>
          {title}
        </div>

        {/* Trick timeline */}
        {trickWins.length > 0 && (
          <div className="bg-slate-900/70 rounded-xl p-3 mb-4 text-left">
            <p className="text-slate-400 text-xs mb-1 font-semibold">
              Trick Timeline&nbsp;
              <span className="text-emerald-400">■ your team</span>
              &nbsp;<span className="text-rose-400">■ opponent</span>
            </p>
            <TrickBar trickWins={trickWins} myTeam={myTeam} />
          </div>
        )}

        {/* Explanation lines */}
        <div className="bg-slate-900/70 rounded-xl p-3 mb-4 text-left">
          <p className="text-slate-400 text-xs font-semibold mb-2">Why this round ended:</p>
          <ul className="space-y-1">
            {lines.map((line, i) => (
              <li key={i} className="text-slate-300 text-xs leading-relaxed">
                {line.startsWith('→') ? (
                  <span className="text-yellow-300 font-semibold">{line}</span>
                ) : line}
              </li>
            ))}
          </ul>
        </div>

        {/* Kothi counter */}
        <div className="bg-slate-900 rounded-xl p-3 mb-4">
          <p className="text-slate-400 text-xs mb-2">Kothi Counter</p>
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  kothiCounter < 0 && i < Math.abs(kothiCounter)
                    ? 'bg-blue-500 border-blue-400'
                    : kothiCounter > 0 && i < kothiCounter
                      ? 'bg-red-500 border-red-400'
                      : 'bg-slate-700 border-slate-600'
                }`} />
            ))}
          </div>
          <p className="text-slate-500 text-xs mt-1">Counter: {kothiCounter}</p>
        </div>

        {/* Kothi awarded */}
        {kothi && (
          <div className="bg-amber-950/50 border border-amber-700 rounded-xl p-3 mb-4">
            <div className="text-2xl mb-1">🐴</div>
            <p className="text-amber-300 font-bold text-sm">Team {kothi} receives a Kothi!</p>
            <p className="text-amber-500 text-xs mt-0.5">Counter resets to 0</p>
          </div>
        )}

        <div className="space-y-2">
          <button onClick={onPlayAgain} className="btn-primary py-3 w-full">
            🃏 Play Next Round
          </button>
          <button onClick={onLobby} className="btn-secondary py-2.5 text-sm w-full">
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  )
}
