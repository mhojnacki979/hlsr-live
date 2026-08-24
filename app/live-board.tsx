'use client'

import { useEffect, useRef, useState } from 'react'
import { DivisionBracket } from '@/components/event/division-bracket'
import type { EventDivision } from '@/data/events'
import { asset } from '@/lib/asset'
import { fetchLive } from '@/lib/eos'
import type { LiveTournament } from '@/lib/live-config'
import { RESUME_AFTER_IDLE_MS, useAutoScroll } from '@/lib/use-auto-scroll'

const POLL_MS = 20_000
/** Leaders shown for a class that has not started eliminations yet. */
const STANDINGS_LIMIT = 8

/** Qualification scores, or the elimination brackets. */
type BoardView = 'qualification' | 'brackets'

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * Qualification scores. `limit` caps the list when this is only a placeholder
 * under Brackets view; in Qualification view every archer is shown so anyone can
 * find their own name.
 */
function Standings({ division, limit }: { division: EventDivision; limit?: number }) {
  const sorted = [...division.qualification].sort((a, b) => a.rank - b.rank)
  const rows = limit === undefined ? sorted : sorted.slice(0, limit)
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
  // null until the first load picks a sensible default; an explicit choice sticks.
  const [view, setView] = useState<BoardView | null>(null)
  const chosenByHand = useRef(false)
  const pausedByButton = useRef(false)
  const resumeTimer = useRef<number | null>(null)

  useAutoScroll(autoScroll)

  // A viewer scrolling by hand takes over, then the loop resumes once they stop.
  // Without the timer a single stray trackpad nudge would park the board forever.
  useEffect(() => {
    const onInteract = (): void => {
      if (pausedByButton.current) return
      setAutoScroll(false)
      if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current)
      resumeTimer.current = window.setTimeout(() => setAutoScroll(true), RESUME_AFTER_IDLE_MS)
    }
    window.addEventListener('wheel', onInteract, { passive: true })
    window.addEventListener('touchstart', onInteract, { passive: true })
    return () => {
      window.removeEventListener('wheel', onInteract)
      window.removeEventListener('touchstart', onInteract)
      if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current)
    }
  }, [])

  /** Explicit Pause always wins over the idle-resume timer. */
  const toggleAutoScroll = (): void => {
    if (resumeTimer.current !== null) {
      window.clearTimeout(resumeTimer.current)
      resumeTimer.current = null
    }
    setAutoScroll((on) => {
      pausedByButton.current = on
      return !on
    })
  }

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
        // Follow the event: qualification until the first bracket appears. Once
        // someone picks a view by hand, leave it alone.
        if (!chosenByHand.current) {
          const anyBracket = data.divisions.some(
            (d) => d.bracket !== null && d.bracket.rounds.length > 0,
          )
          setView(anyBracket ? 'brackets' : 'qualification')
        }
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
            <div className="board-view-toggle" role="tablist" aria-label="Board view">
              {(['qualification', 'brackets'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={view === mode}
                  className="board-view-btn"
                  onClick={() => {
                    chosenByHand.current = true
                    setView(mode)
                  }}
                >
                  {mode === 'qualification' ? 'Qualification' : 'Brackets'}
                </button>
              ))}
            </div>
            <a className="board-results-link" href="https://hlsr.eyesonscore.com">
              Full Results
            </a>
            <span className="live-dot" aria-hidden="true" />
            <span className="live-label">Live</span>
            {updatedAt !== null && (
              <span className="board-updated">Updated {clockTime(updatedAt)}</span>
            )}
            <button
              type="button"
              className="board-toggle"
              onClick={toggleAutoScroll}
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
          // Qualification view always shows scores, every archer. Brackets view
          // shows the tree, falling back to the leaders where none exists yet.
          const showBracket = view === 'brackets' && hasBracket
          const archers = division.qualification.length
          return (
            <section className="board-class" key={division.name}>
              <h2 className="board-class-name">
                {division.name}
                {view === 'qualification' ? (
                  <span className="board-class-tag">
                    {archers} {archers === 1 ? 'archer' : 'archers'}
                  </span>
                ) : (
                  !hasBracket && <span className="board-class-tag">Not started</span>
                )}
              </h2>
              {showBracket ? (
                <DivisionBracket division={division} />
              ) : (
                <Standings
                  division={division}
                  limit={view === 'qualification' ? undefined : STANDINGS_LIMIT}
                />
              )}
            </section>
          )
        })}
      </main>
    </>
  )
}
