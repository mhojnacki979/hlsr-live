import { LIVE_TOURNAMENT } from '@/lib/live-config'
import { LiveBoard } from './live-board'

export default function HomePage() {
  return <LiveBoard tournament={LIVE_TOURNAMENT} />
}
