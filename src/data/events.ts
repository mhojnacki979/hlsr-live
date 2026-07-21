/**
 * Result types shared by the board components, plus podium derivation.
 *
 * Brackets are the authoritative single-elimination pairing trees from Eyes on
 * Score (tournament_group_bracket_layout): seeds, head-to-head matches, real
 * winners. A division with no bracket (e.g. 3D qualification only) falls back to
 * top qualifiers for its placings.
 */

export interface EventQualRow {
  rank: number
  name: string
  avg: string
  score: number
}

/** One archer's side of a head-to-head match. */
export interface BracketShooter {
  name: string
  seed: number
  score: number
  winner: boolean
}

export interface BracketMatch {
  a: BracketShooter
  b: BracketShooter | null
}

export interface BracketRound {
  name: string
  matches: BracketMatch[]
}

export interface EventBracket {
  rounds: BracketRound[]
}

export interface EventDivision {
  name: string
  champion: string | null
  qualification: EventQualRow[]
  bracket: EventBracket | null
}

export interface Podium {
  first: string | null
  second: string | null
  third: string | null
}

/** One finishing position, 1st through Nth. */
export interface Placing {
  place: number
  name: string
  /** Elimination score for bracket places, qualification total otherwise. */
  score: number
  /** Whether the place was earned in the bracket or fell back to qualification. */
  source: 'bracket' | 'qualification'
}

/** Names come from two EOS endpoints and can differ in case/spacing. */
function nameKey(name: string): string {
  return name.trim().toLowerCase()
}

/** Qualification seed for an archer, used to break equal elimination scores. */
function qualRank(division: EventDivision, name: string): number {
  const key = nameKey(name)
  const row = division.qualification.find((q) => nameKey(q.name) === key)
  return row?.rank ?? Number.MAX_SAFE_INTEGER
}

/** A losing archer plus how deep they got — later round means a better place. */
interface EliminatedShooter {
  shooter: BracketShooter
  roundIndex: number
}

/** Every archer who lost a match, tagged with the round they went out in. */
function bracketLosers(division: EventDivision): EliminatedShooter[] {
  const losers: EliminatedShooter[] = []
  const rounds = division.bracket?.rounds ?? []
  rounds.forEach((round, roundIndex) => {
    for (const match of round.matches) {
      for (const shooter of [match.a, match.b]) {
        if (shooter !== null && !shooter.winner) losers.push({ shooter, roundIndex })
      }
    }
  })
  return losers
}

/**
 * Finishing order, 1st through `limit`.
 *
 * 1-4 come from the final round: match 0 is the gold match (winner 1st, loser
 * 2nd), match 1 the bronze match (winner 3rd, loser 4th). Remaining places go to
 * the other bracket losers ranked by elimination score, ties broken by the
 * better qualification seed. Classes whose bracket was only four archers have no
 * further losers, so the rest of the eight fill from qualification rank.
 */
export function getPlacings(division: EventDivision, limit = 8): Placing[] {
  const placings: Placing[] = []
  const taken = new Set<string>()

  const add = (name: string, score: number, source: Placing['source']): void => {
    const key = nameKey(name)
    if (key === '' || taken.has(key)) return
    taken.add(key)
    placings.push({ place: placings.length + 1, name, score, source })
  }

  // Places 1-4 — the gold and bronze matches of the final round.
  const rounds = division.bracket?.rounds ?? []
  const final = rounds[rounds.length - 1]
  for (const match of final?.matches.slice(0, 2) ?? []) {
    const aWon = match.a.winner
    const bWon = match.b?.winner === true
    const winner = aWon ? match.a : bWon ? match.b : null
    const loser = aWon ? match.b : bWon ? match.a : null
    if (winner !== null) add(winner.name, winner.score, 'bracket')
    if (loser !== null && loser !== undefined) add(loser.name, loser.score, 'bracket')
  }

  // Places 5+ — World Archery order: the round you went out in first (a
  // quarter-final loser always outranks a 1/8 loser), then your score in the
  // match that eliminated you, then the better qualification seed.
  const remaining = bracketLosers(division)
    .filter((e) => !taken.has(nameKey(e.shooter.name)))
    .sort(
      (a, b) =>
        b.roundIndex - a.roundIndex ||
        b.shooter.score - a.shooter.score ||
        qualRank(division, a.shooter.name) - qualRank(division, b.shooter.name),
    )
  for (const { shooter } of remaining) {
    if (placings.length >= limit) break
    add(shooter.name, shooter.score, 'bracket')
  }

  // Fill any shortfall from the qualification standings.
  for (const row of [...division.qualification].sort((a, b) => a.rank - b.rank)) {
    if (placings.length >= limit) break
    add(row.name, row.score, 'qualification')
  }

  return placings
}

function matchWinner(m: BracketMatch): string | null {
  if (m.a.winner) return m.a.name
  if (m.b?.winner) return m.b.name
  return null
}

function matchLoser(m: BracketMatch): string | null {
  if (m.a.winner) return m.b?.name ?? null
  return m.a.name
}

/**
 * Final placings. In the final round, match 0 is the gold match (winner = 1st,
 * loser = 2nd) and match 1 is the bronze match (winner = 3rd). Falls back to the
 * top qualifiers when a division has no bracket.
 */
export function getPodium(division: EventDivision): Podium {
  const rounds = division.bracket?.rounds ?? []
  const final = rounds[rounds.length - 1]
  const gold = final?.matches[0]
  if (gold !== undefined) {
    return {
      first: matchWinner(gold),
      second: matchLoser(gold),
      third: final?.matches[1] ? matchWinner(final.matches[1]) : null,
    }
  }
  const seeded = [...division.qualification].sort((a, b) => a.rank - b.rank)
  return {
    first: seeded[0]?.name ?? null,
    second: seeded[1]?.name ?? null,
    third: seeded[2]?.name ?? null,
  }
}
