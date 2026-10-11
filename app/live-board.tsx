'use client'

import { useEffect, useRef, useState } from 'react'
import { DivisionBracket } from '@/components/event/division-bracket'
import type { EventDivision } from '@/data/events'
import { getPlacings } from '@/data/events'
import { asset } from '@/lib/asset'
import { EosUnavailableError, fetchLive } from '@/lib/eos'
import { EVENT_DATES } from '@/lib/live-config'
import type { LiveTournament } from '@/lib/live-config'
import { RESUME_AFTER_IDLE_MS, useAutoScroll } from '@/lib/use-auto-scroll'

/**
 * How often each viewer asks EOS for fresh scores.
 *
 * This multiplies by the number of phones in the building — at 20s, a hundred
 * spectators alone were 5 requests/sec against the single Linode that also
 * serves the API, the website and the database, and it was already answering
 * some requests with 429. At 60s the same crowd costs 1.7/sec, and nobody
 * watching a bracket notices the difference.
 */
const POLL_MS = 60_000
/** Leaders shown for a class that has not started eliminations yet. */
const STANDINGS_LIMIT = 8

/** Shown in the header: the board carries every competition, not one of them. */
const BOARD_TITLE = '2027 Archery Competition'

/** Qualification scores, or the elimination brackets. */
type BoardView = 'qualification' | 'brackets'

/** Medal styling for the podium line. */
const MEDAL_CLASS = ['is-gold', 'is-silver', 'is-bronze'] as const

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function ordinal(place: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'][place % 10] ?? 'th'
  return `${place}${suffix}`
}

/**
 * Podium line above a class's bracket.
 *
 * Only rendered once the class actually has a champion — mid-event the gold
 * match has no winner yet, so naming a 1st place would be wrong.
 */
function Podium({ division }: { division: EventDivision }) {
  if (division.champion === null) return null
  const places = getPlacings(division, 3)
  if (places.length === 0) return null
  return (
    <ol className="board-podium" aria-label={`${division.name} placings`}>
      {places.map((p) => (
        <li className={`board-podium-item ${MEDAL_CLASS[p.place - 1] ?? ''}`} key={p.name}>
          <span className="board-podium-place">{ordinal(p.place)}</span>
          <span className="board-podium-name">{p.name}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Qualification scores. `limit` caps the list when this is only a placeholder
 * under Brackets view; in Qualification view every archer is shown so anyone can
 * find their own name.
 */
/**
 * Arrows shot out of arrows in the round — "15/60".
 *
 * Read from across a room, the standings otherwise mislead: a 122 from 15
 * arrows sits in the same ordered list as a 486 from 60 with nothing to say
 * one archer is a round behind rather than losing by 364. Still-shooting is
 * the state worth calling out; finished is the quiet one.
 */
function ArrowCount({ shot, total }: { shot?: number; total?: number }) {
  if (total === undefined || total <= 0) return null
  const n = shot ?? 0
  // Three states, not two. An archer on 0 has not started; highlighting them
  // would drown out the genuinely part-shot archers, whose score misleads.
  const state = n >= total ? 'done' : n === 0 ? 'waiting' : 'shooting'
  return (
    <span
      className={`board-arrows is-${state}`}
      title={state === 'done' ? 'Round complete' : `${total - n} arrows remaining`}
    >
      {n}/{total}
    </span>
  )
}

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
          <ArrowCount shot={r.arrows} total={r.arrowsTotal} />
          <span className="board-standing-score">{r.score}</span>
        </li>
      ))}
    </ol>
  )
}

/** One competition's classes, in the order the board scrolls them. */
interface Block {
  tournament: LiveTournament
  divisions: EventDivision[]
}

export function LiveBoard({ tournaments }: { tournaments: LiveTournament[] }) {
  // Every competition is on the board at once: the scroll runs through the
  // first, then straight into the next.
  const [blocks, setBlocks] = useState<Block[]>([])
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Distinguishes "still fetching" from "fetched, but nothing entered yet".
  const [loaded, setLoaded] = useState(false)
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
    if (tournaments.length === 0) return
    let cancelled = false

    const load = async (): Promise<void> => {
      try {
        // One score list per competition per poll. Bracket requests are only
        // paid for when brackets are on screen — in qualification that keeps
        // the whole board to one request per competition.
        const loaded = await Promise.all(
          tournaments.map(async (t) => ({
            tournament: t,
            data: await fetchLive(t.id, {
              withBrackets: view === 'brackets' || t.publishQualification === false,
              ...(t.privateScores === true ? { privateScores: true } : {}),
              ...(t.roundArrows !== undefined ? { roundArrows: t.roundArrows } : {}),
            }),
          })),
        )
        if (cancelled) return
        setBlocks(loaded.map(({ tournament, data }) => ({ tournament, divisions: data.divisions })))
        setUpdatedAt(Math.max(...loaded.map(({ data }) => data.updatedAt)))
        setError(null)
        setLoaded(true)
        // Follow the event: qualification until eliminations begin anywhere.
        // Once someone picks a view by hand, leave it alone.
        if (!chosenByHand.current) {
          const started = loaded.some(
            ({ tournament, data }) =>
              tournament.publishQualification === false ||
              data.eliminationsStarted ||
              data.divisions.some((d) => d.bracket !== null && d.bracket.rounds.length > 0),
          )
          // One way only. This runs on every poll, so setting it both ways let
          // a single thin answer from EOS throw the board back to
          // qualification mid-round — and from there the brackets it needed to
          // recover were no longer being fetched. The event does not go back
          // to qualification, so neither does the board.
          if (started) setView('brackets')
          else setView((current) => current ?? 'qualification')
        }
      } catch (e) {
        // Only EOS's own wording is fit for the board; anything else is a bug
        // in our code and must not put a stack message on a venue screen.
        if (!cancelled) {
          setError(
            e instanceof EosUnavailableError
              ? e.message
              : 'Scores are temporarily unavailable. Retrying…',
          )
          if (!(e instanceof EosUnavailableError)) console.error('[live-board]', e)
        }
      }
    }

    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // `view` is a dependency on purpose: choosing Brackets refetches straight
    // away with bracket data, rather than leaving the viewer on an empty tab
    // until the next poll.
  }, [tournaments, view])

  if (tournaments.length === 0) {
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
              <h1 className="board-title">{BOARD_TITLE}</h1>
            </div>
          </div>
          <div className="board-status">
            {/* Applies to the whole board: every competition follows it. */}
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
            {/* Dot and label must wrap as one unit, or the phone header
                splits them across two rows. */}
            <span className="board-live">
              <span className="live-dot" aria-hidden="true" />
              <span className="live-label">Live</span>
            </span>
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
        {/* A hiccup with scores already on screen is a footnote, not a wall —
            the board keeps showing the last good data underneath. */}
        {error !== null &&
          (blocks.length > 0 ? (
            <p className="board-stale">{error} Showing the last scores received.</p>
          ) : (
            <p className="board-error">{error}</p>
          ))}
        {blocks.every((b) => b.divisions.length === 0) && error === null && (
          <p className="board-empty">
            {loaded ? `Competition begins ${EVENT_DATES} — scores appear here live.` : 'Loading scores…'}
          </p>
        )}

        {blocks.map(({ tournament, divisions }) => {
          const hideQuals = tournament.publishQualification === false
          // A competition with no brackets anywhere is a qualification result
          // and nothing else — 3D is shot once and the scores stand. Showing it
          // the Brackets way would label finished classes "Not started" and cut
          // each one to its leaders, so it keeps its own full standings
          // whichever view the board is on.
          const bracketed = divisions.some((d) => d.bracket !== null && d.bracket.rounds.length > 0)
          const compView = bracketed ? view : 'qualification'
          return (
            <section className="board-competition" key={tournament.id}>
              {/* Named on every block, so a viewer joining the scroll part-way
                  through always knows which competition is on screen. */}
              <h2 className="board-competition-name">{tournament.label}</h2>
              {divisions.length === 0 ? (
                <p className="board-empty">No scores yet.</p>
              ) : (
                divisions.map((division) => {
                  const hasBracket = division.bracket !== null && division.bracket.rounds.length > 0
                  // Qualification view always shows scores, every archer. Brackets
                  // view shows the tree, falling back to the leaders where none
                  // exists yet.
                  const showBracket = compView === 'brackets' && hasBracket
                  const archers = division.qualification.length
                  return (
                    <section className="board-class" key={division.name}>
                      <h3 className="board-class-name">
                        {division.name}
                        {!hideQuals && compView === 'qualification' ? (
                          <span className="board-class-tag">
                            {archers} {archers === 1 ? 'archer' : 'archers'}
                          </span>
                        ) : (
                          !hasBracket && <span className="board-class-tag">Not started</span>
                        )}
                      </h3>
                      {showBracket ? (
                        <>
                          <Podium division={division} />
                          <DivisionBracket division={division} />
                        </>
                      ) : hideQuals ? (
                        <p className="board-empty">Brackets begin Sunday.</p>
                      ) : (
                        <Standings
                          division={division}
                          limit={compView === 'qualification' ? undefined : STANDINGS_LIMIT}
                        />
                      )}
                    </section>
                  )
                })
              )}
            </section>
          )
        })}
      </main>
    </>
  )
}
