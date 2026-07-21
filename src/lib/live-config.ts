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
}

// Currently aimed at the 2025 HLSR Target competition, which has completed
// brackets in every class — useful for testing the board end to end.
// Swap in the live tournament id on event day.
export const LIVE_TOURNAMENT: LiveTournament | null = {
  id: 'Wk1VVU9WL2EzL04yYUFRVDdKdXYyZz09',
  name: 'HLSR Archery Competition',
}
