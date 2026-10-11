/**
 * Client-side Eyes on Score API access for the live page.
 *
 * Runs entirely in the visitor's browser (CORS is open on the EOS API). The
 * token is EOS's public read-only scoreboard token — the same one their own
 * public scoreboard ships in client code — so embedding it here is expected.
 */
import type { BracketMatch, BracketShooter, EventBracket, EventDivision } from '@/data/events'

const API = 'https://api.eyesonscore.com/api'
const TOKEN = 'Bearer 08a42685c4d02c948fd16848e38e194bab23d2ba90d390e14b772122f631c3b0b18f8cc3170040fa'

/**
 * A failure fit to show a spectator.
 *
 * EOS does not always answer with JSON — when it is rate-limiting, down, or
 * behind an error page it returns HTML, and `res.json()` then throws a raw
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. That string used
 * to go straight onto the venue screen. Everything that leaves this module is
 * phrased for the person reading the board; the technical detail goes to the
 * console for whoever is debugging.
 */
export class EosUnavailableError extends Error {
  constructor(message: string, detail?: unknown) {
    super(message)
    this.name = 'EosUnavailableError'
    if (detail !== undefined) console.error('[eos]', detail)
  }
}

async function request(path: string, init: RequestInit): Promise<any> {
  let res: Response
  try {
    res = await fetch(`${API}/${path}`, init)
  } catch (e) {
    throw new EosUnavailableError('Cannot reach Eyes on Score. Retrying…', e)
  }

  // Read as text first: a non-JSON body is the common failure, not the rare one.
  const body = await res.text()
  let json: any
  try {
    json = JSON.parse(body)
  } catch {
    throw new EosUnavailableError(
      res.status === 429
        ? 'Eyes on Score is busy. Scores will refresh shortly.'
        : 'Eyes on Score is not responding. Scores will refresh shortly.',
      `${path} -> HTTP ${res.status}, non-JSON body: ${body.slice(0, 120)}`,
    )
  }

  if (json.status_code !== 200) {
    throw new EosUnavailableError(
      'Scores are temporarily unavailable. Retrying…',
      `${path} -> ${json.message ?? `status_code ${json.status_code}`}`,
    )
  }
  return json.data
}

async function post(path: string): Promise<any> {
  return request(path, {
    method: 'POST',
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
  })
}

/** Some EOS endpoints (shooter detail) expect form-encoded bodies. */
async function postForm(path: string, body: Record<string, string>): Promise<any> {
  return request(path, {
    method: 'POST',
    headers: { Authorization: TOKEN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })
}

function toInt(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

function rowsOf(sorting: any, group: string): any[] {
  const inner = sorting?.[group]
  if (inner === undefined || inner === null) return []
  // The group object mixes shooter rows with metadata keys (max_round_count,
  // elimination_round_list, active_elimination_round) — keep only shooters.
  return Object.values(inner).filter(
    (v) => typeof v === 'object' && v !== null && 'name' in v,
  )
}

function shooterCard(s: any): BracketShooter {
  return {
    name: String(s?.name ?? '').trim(),
    seed: toInt(s?.rank),
    score: toInt(s?.score),
    winner: String(s?.winner ?? '') === '1',
  }
}

function toMatches(shooters: any[]): BracketMatch[] {
  const matches: BracketMatch[] = []
  for (let i = 0; i < shooters.length; i += 2) {
    matches.push({
      a: shooterCard(shooters[i]),
      b: shooters[i + 1] ? shooterCard(shooters[i + 1]) : null,
    })
  }
  return matches
}

export interface LiveData {
  divisions: EventDivision[]
  updatedAt: number
  /** Any division has a round beyond Qualification — eliminations are under way. */
  eliminationsStarted: boolean
}

/**
 * Whether this division has progressed past qualification.
 *
 * EOS lists one entry per stage in `elimination_round_list`, and qualification
 * is itself listed as a stage — so a lone "Qualification" entry means nobody
 * has shot a head-to-head yet and there is no bracket to fetch.
 */
export function hasEliminationRound(group: any): boolean {
  const list = group?.elimination_round_list
  if (!Array.isArray(list)) return false
  return list.some((r) => {
    const name = String(r?.tournament_name ?? '').trim().toLowerCase()
    // An unnamed entry is not evidence of a round: treating "" as a real round
    // would fetch every bracket and force the Brackets view off a malformed row.
    return name !== '' && name !== 'qualification'
  })
}

/**
 * Fetch a live snapshot: qualification standings, plus a bracket per division.
 *
 * The bracket layout is a SEPARATE request per division — 24 of them for the
 * HLSR Target tournament, fired at once — so a naive poll costs 25 requests
 * per viewer and opens 24 simultaneous connections. Multiplied by a venue full
 * of phones that is what trips rate limiting, so brackets are fetched only for
 * divisions that have actually reached eliminations.
 *
 * `withBrackets` overrides that and fetches every division. The Brackets tab
 * passes it, so if the round-list signal above is ever wrong, choosing that tab
 * still shows real brackets — a wrong guess costs a delayed auto-switch, never
 * missing data.
 */
export async function fetchLive(
  tournamentId: string,
  opts: { withBrackets?: boolean; privateScores?: boolean; roundArrows?: number } = {},
): Promise<LiveData> {
  // EOS holds some tournaments private; their public read returns nothing at
  // all, so the flag has to match how the tournament is set up.
  const qual = await post(
    `tournament_score_list?is_private=${opts.privateScores === true}&id=${tournamentId}&for_fav=true`,
  )
  const sorting = qual.sortingResult ?? {}
  const groups = Object.keys(sorting)
  const eliminationsStarted = groups.some((g) => hasEliminationRound(sorting[g]))

  const divisions = await Promise.all(
    groups.map(async (group) => {
      const wantBracket = opts.withBrackets === true || hasEliminationRound(sorting[group])
      const rows = rowsOf(sorting, group)
      const qualification = rows.map((r) => ({
        rank: toInt(r.rank),
        name: String(r.name ?? '').trim(),
        avg: String(r.avg_count ?? r.arr_avg ?? ''),
        score: toInt(r.total_score),
        shooterId: String(r.shooter_id ?? ''),
        arrows: toInt(r.total_attended_arrows_count),
        // A 3D round is set to 25 for the shoot-down but scored over 20.
        arrowsTotal: opts.roundArrows ?? toInt(r.total_arrow_count),
      }))

      // Bracket (only if this division's elimination has started).
      let bracket: EventBracket | null = null
      let champion: string | null = null
      const shooterId = String(rows[0]?.shooter_id ?? '')
      if (wantBracket && shooterId !== '') {
        const layout = await post(
          `tournament_group_bracket_layout?id=${tournamentId}&shooter_id=${encodeURIComponent(shooterId)}`,
        ).catch(() => null)
        const result = layout?.result
        const rounds = result
          ? Object.entries(result)
              .map(([name, shooters]) => ({ name, matches: toMatches(shooters as any[]) }))
              .filter((r) => r.matches.length > 0)
          : []
        if (rounds.length > 0) {
          bracket = { rounds }
          const final = rounds[rounds.length - 1]
          const gold = final?.matches[0]
          champion = gold?.a.winner ? gold.a.name : gold?.b?.winner ? gold.b.name : null
        }
      }

      return { name: group, champion, qualification, bracket }
    }),
  )

  return { divisions, updatedAt: Date.now(), eliminationsStarted }
}

export interface EndScore {
  label: string
  arrows: number[]
  /** Points scored this end. */
  score: number
  /** Cumulative total through this end. */
  running: number
}

export interface ShooterDetail {
  name: string
  total: number
  avg: string
  target: string
  ends: EndScore[]
}

function arrowsOf(end: any): number[] {
  return Object.keys(end)
    .filter((k) => /^arrow\d+$/.test(k))
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
    .map((k) => toInt(end[k]?.score))
}

/** A shooter's end-by-end / arrow-by-arrow scorecard for one tournament. */
export async function fetchShooterEnds(
  tournamentId: string,
  shooterId: string,
): Promise<ShooterDetail> {
  const d = await postForm('shooter_details_by_score', {
    shooter_id: shooterId,
    tournament_id: tournamentId,
  })

  const ends: EndScore[] = []
  for (const slot of d.slot_list ?? []) {
    for (const round of slot.round_score_list ?? []) {
      Object.keys(round)
        .filter((k) => /^end\d+$/.test(k))
        .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))
        .forEach((k) => {
          const end = round[k]
          if (end && typeof end === 'object') {
            ends.push({
              label: `End ${ends.length + 1}`,
              arrows: arrowsOf(end),
              score: toInt(end.per_end_total ?? end.end_total),
              running: toInt(end.end_total ?? end.per_end_total),
            })
          }
        })
    }
  }

  return {
    name: String(d.shooter_name ?? '').trim(),
    total: toInt(d.total_score),
    avg: String(d.avg_count ?? ''),
    target: String(d.target_name_position ?? ''),
    ends,
  }
}
