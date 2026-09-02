/**
 * Which EOS tournament the board displays.
 *
 * `id` is the long token from a tournament's Eyes on Score URL. Point it at the
 * event that is shooting; set the whole export to null between events to show
 * the idle state. Scores refresh on their own while the board is up — this only
 * chooses the tournament. Changing it requires a redeploy (static site).
 */
export interface LiveTournament {
  id: string
  name: string
  /**
   * Whether this tournament's qualification scores may be shown.
   *
   * HLSR asked that 3D qualification not be published — only the Sunday
   * brackets. When false the board hides the Qualification view entirely and
   * never renders a score list, so pointing the board at the 3D tournament is
   * safe.
   */
  publishQualification?: boolean
}

// The 2027 competition — October 9-11, 2026, Reliant Center Hall A.
// Registration is open; EOS fills in classes and entries closer to the event,
// so the board shows a waiting state until scores start arriving. Point this at
// the 3D tournament on Sunday (its qualification stays withheld automatically).
export const LIVE_TOURNAMENT: LiveTournament | null = {
  id: 'MWNOdFN5WnJ4VFZmQThEUk9jNUVadz09',
  name: '2027 Houston Livestock Show and Rodeo Archery Competition',
}

/** Shown when the tournament exists but has no entries loaded yet. */
export const EVENT_DATES = 'October 9-11, 2026'
