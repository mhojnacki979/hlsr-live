'use client'

import { useEffect, useState } from 'react'
import { DivisionBracket } from '@/components/event/division-bracket'
import type { EventDivision } from '@/data/events'
import { asset } from '@/lib/asset'
import { fetchLive } from '@/lib/eos'
import type { LiveTournament } from '@/lib/live-config'
import { useAutoScroll } from '@/lib/use-auto-scroll'

const POLL_MS = 20_000
/** Standings shown for a class that has not started eliminations yet. */
const STANDINGS_LIMIT = 8

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Qualification leaders — what a class shows before its bracket exists. */
function Standings({ division }: { division: EventDivision }) {
  const rows = [...division.qualification].sort((a, b) => a.rank - b.rank).slice(0, STANDINGS_LIMIT)
  if (rows.length === 0) return <p className="muted">No scores yet.</p>
  return (
    <ol className="board-standings">
      {rows.map((r) => (
        <li className="board-standing" key={`${r.rank}-${r.name}`}>
          <span className="board-standing-rank">{r.rank}</span>
          <span className="board-standing-name">{r.name}</span>
          <span className="board-standing-score">{r.score}</span>
        </li>
      ))}
    </ol>
  )
}

export function LiveBoard({ tournament }: { tournament: LiveTournament | null }) {
  const [divisions, setDivisions] = useState<EventDivision[]>([])
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useAutoScroll(autoScroll)

  // A viewer taking over on a phone stops the loop until they hand it back.
  useEffect(() => {
    const yield_ = (): void => setAutoScroll(false)
    window.addEventListener('wheel', yield_, { passive: true })
    window.addEventListener('touchstart', yield_, { passive: true })
    return () => {
      window.removeEventListener('wheel', yield_)
      window.removeEventListener('touchstart', yield_)
    }
  }, [])

  useEffect(() => {
    if (tournament === null) return
    let cancelled = false

    const load = async (): Promise<void> => {
      try {
        const data = await fetchLive(tournament.id)
        if (cancelled) return
        setDivisions(data.divisions)
        setUpdatedAt(data.updatedAt)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not reach Eyes on Score')
      }
    }

    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [tournament])

  if (tournament === null) {
    return (
      <main className="board">
        <p className="board-empty">No event is live right now.</p>
      </main>
    )
  }

  return (
    <>
      <header className="board-header">
        <div className="board-header-inner">
          <div className="board-brand">
            <img
              src={asset('/brand/hlsr-archery-badge.png')}
              alt=""
              className="board-badge"
              aria-hidden="true"
            />
            <div>
              <span className="board-kicker">Houston Livestock Show &amp; Rodeo</span>
              <h1 className="board-title">{tournament.name}</h1>
            </div>
          </div>
          <div className="board-status">
            <span className="live-dot" aria-hidden="true" />
            <span className="live-label">Live</span>
            {updatedAt !== null && (
              <span className="board-updated">Updated {clockTime(updatedAt)}</span>
            )}
            <button
              type="button"
              className="board-toggle"
              onClick={() => setAutoScroll((on) => !on)}
            >
              {autoScroll ? 'Pause' : 'Auto-scroll'}
            </button>
          </div>
        </div>
      </header>

      <main className="board">
        {error !== null && <p className="board-error">{error}</p>}
        {divisions.length === 0 && error === null && <p className="board-empty">Loading scores…</p>}

        {divisions.map((division) => {
          const hasBracket = division.bracket !== null && division.bracket.rounds.length > 0
          return (
            <section className="board-class" key={division.name}>
              <h2 className="board-class-name">
                {division.name}
                {!hasBracket && <span className="board-class-tag">Qualification</span>}
              </h2>
              {hasBracket ? <DivisionBracket division={division} /> : <Standings division={division} />}
            </section>
          )
        })}
      </main>
    </>
  )
}
