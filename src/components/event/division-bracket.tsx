import type { BracketMatch, BracketShooter, EventDivision } from '@/data/events'

/**
 * True single-elimination bracket. Each round is a column of head-to-head
 * matches (the EOS pairing tree); winners flow rightward toward the Champion.
 *
 * The final round holds two games stacked in the Finals column: the gold
 * Championship match (winner = 1st, loser = 2nd) on top, then the bronze 3rd
 * Place Match contested by the semi-final losers (winner = 3rd) below it.
 */

const FINAL_CAPTIONS = ['Championship', '3rd Place Match'] as const

function ShooterRow({ shooter }: { shooter: BracketShooter | null }) {
  if (shooter === null) {
    return (
      <div className="match-row is-bye">
        <span className="match-seed" />
        <span className="match-name muted">Bye</span>
      </div>
    )
  }
  return (
    <div className={`match-row${shooter.winner ? ' is-winner' : ''}`}>
      <span className="match-seed">{shooter.seed}</span>
      <span className="match-name">{shooter.name}</span>
      <span className="match-score">{shooter.score}</span>
    </div>
  )
}

function Match({ match, caption }: { match: BracketMatch; caption?: string }) {
  const bronze = caption === '3rd Place Match'
  return (
    <div className="match-wrap">
      {caption !== undefined && (
        <span className={`match-caption${bronze ? ' is-bronze' : ''}`}>{caption}</span>
      )}
      <div className={`match${bronze ? ' is-bronze-match' : ''}`}>
        <ShooterRow shooter={match.a} />
        <ShooterRow shooter={match.b} />
      </div>
    </div>
  )
}

export function DivisionBracket({ division }: { division: EventDivision }) {
  const rounds = division.bracket?.rounds ?? []
  if (rounds.length === 0) {
    return <p className="muted">No bracket recorded for this division.</p>
  }
  const lastIndex = rounds.length - 1

  return (
    <div className="bracket-scroll">
      <div className="bracket-grid">
        {rounds.map((round, i) => {
          const isFinal = i === lastIndex
          return (
            <div className={`bracket-col${isFinal ? ' bracket-col-finals' : ''}`} key={`${round.name}-${i}`}>
              <div className="bracket-col-head">
                <span className="bracket-col-name">{round.name}</span>
              </div>
              <div className="bracket-col-matches">
                {round.matches.map((m, j) => (
                  <Match
                    match={m}
                    caption={isFinal ? FINAL_CAPTIONS[j] : undefined}
                    key={`${m.a.name}-${m.b?.name ?? 'bye'}-${j}`}
                  />
                ))}
              </div>
            </div>
          )
        })}
        {division.champion !== null && (
          <div className="bracket-col bracket-col-champion">
            <div className="bracket-col-head">
              <span className="bracket-col-name is-gold">Champion</span>
            </div>
            <div className="bracket-col-matches">
              <div className="champion-chip">{division.champion}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
