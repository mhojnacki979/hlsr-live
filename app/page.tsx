import { LIVE_TOURNAMENTS } from '@/lib/live-config'
import { LiveBoard } from './live-board'

export default function HomePage() {
  return <LiveBoard tournaments={LIVE_TOURNAMENTS} />
}
