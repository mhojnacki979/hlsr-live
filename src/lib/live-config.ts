/**
 * Which EOS tournaments the board displays.
 *
 * `id` is the long token from a tournament's Eyes on Score URL. List the
 * competitions that are shooting; set the whole export to an empty array
 * between events to show the idle state. Scores refresh on their own while the
 * board is up — this only chooses the tournaments. Changing it requires a
 * redeploy (static site).
 */
export interface LiveTournament {
  id: string
  name: string
  /** Short name for the tournament tabs, e.g. "Target". */
  label: string
  /**
   * Whether this tournament's qualification scores may be shown.
   *
   * When false the board hides the Qualification view entirely and never
   * renders a score list, so pointing the board at a withheld competition is
   * safe. HLSR withheld 3D qualification while the course was being shot and
   * released it on 11 October, once every line had finished.
   */
  publishQualification?: boolean
  /**
   * Read this tournament with `is_private=true`.
   *
   * EOS holds the 2027 3D competition private: the public read comes back
   * empty and only the private one returns scores. Separate from
   * `publishQualification`, which is about showing them.
   */
  privateScores?: boolean
  /**
   * Arrows shot for score, when EOS's round size is larger.
   *
   * The 3D round is set to 25 so the last 5 are there for a shoot-down, which
   * only some divisions shoot. Left at EOS's figure, every archer reads
   * "20/25 still shooting" and no division is ever treated as finished.
   */
  roundArrows?: number
  /**
   * EOS id of the bracket's Finals round, read for its arrow counts.
   *
   * EOS flags whoever is ahead of a match as its winner while it is still
   * being shot. With this set, a final only counts as won once every archer in
   * it has shot every arrow. It is the id EOS's own live-bracket page reads.
   */
  finalsRoundId?: string
}

// The 2027 competition — October 9-11, 2026, Reliant Center Hall A.
export const LIVE_TOURNAMENTS: LiveTournament[] = [
  {
    id: 'MWNOdFN5WnJ4VFZmQThEUk9jNUVadz09',
    name: '2027 Houston Livestock Show and Rodeo Archery Competition',
    label: 'Target',
    finalsRoundId: 'ZENxVmxXV0xUaE8wczdmMzhGNUZHdz09',
  },
  {
    id: 'UWcxL0RMaWx4RllZczhQU09yeVlTZz09',
    name: '2027 HLSR 3D Archery Competition',
    label: '3D',
    privateScores: true,
    roundArrows: 20,
  },
]

/** Shown when a tournament exists but has no entries loaded yet. */
export const EVENT_DATES = 'October 9-11, 2026'
