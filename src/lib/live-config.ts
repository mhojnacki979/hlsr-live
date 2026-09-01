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

// Aimed at the 2026 Target competition (completed brackets in every class) for
// testing the board end to end. Swap in the live tournament id on event day.
export const LIVE_TOURNAMENT: LiveTournament | null = {
  id: 'dnlSWGkxeXhiTXNZSHk4RFpZVVBVZz09',
  name: 'Houston Livestock Show and Rodeo Archery Competition',
}
