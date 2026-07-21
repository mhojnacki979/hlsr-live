'use client'

import { useEffect } from 'react'

/** Slow enough to read a bracket as it passes. */
export const SPEED_PX_PER_SEC = 45
/** Hold at the bottom before restarting from the top. */
export const BOTTOM_PAUSE_MS = 5000
/** Hand the loop back this long after a viewer stops scrolling themselves. */
export const RESUME_AFTER_IDLE_MS = 30_000

export type ScrollPhase = 'scrolling' | 'holding'

export interface ScrollState {
  phase: ScrollPhase
  /** Timestamp the bottom hold expires (only meaningful while holding). */
  holdUntil: number
  /**
   * Our own sub-pixel scroll position.
   *
   * Critical: at 45px/s and 60fps each frame advances 0.75px. Browsers quantise
   * window.scrollY to whole pixels, so re-reading it every frame would round the
   * advance away and the page would never move. We accumulate here as a float
   * and only push the value out to the window.
   */
  position: number
}

export interface ScrollStep {
  /** Where to move the window, or null to stay put this frame. */
  scrollTo: number | null
  state: ScrollState
}

export const INITIAL_SCROLL_STATE: ScrollState = {
  phase: 'scrolling',
  holdUntil: 0,
  position: 0,
}

/**
 * One frame of the venue-screen loop, kept pure so it can be tested without a
 * browser: creep down, land exactly on the bottom and hold, then jump back to
 * the top and start over.
 */
export function nextScrollStep(
  state: ScrollState,
  now: number,
  elapsedSec: number,
  maxScroll: number,
): ScrollStep {
  if (maxScroll <= 0) return { scrollTo: null, state }

  if (state.phase === 'holding') {
    if (now >= state.holdUntil) {
      return { scrollTo: 0, state: { phase: 'scrolling', holdUntil: 0, position: 0 } }
    }
    return { scrollTo: null, state }
  }

  const next = state.position + SPEED_PX_PER_SEC * elapsedSec
  if (next >= maxScroll - 1) {
    return {
      scrollTo: maxScroll,
      state: { phase: 'holding', holdUntil: now + BOTTOM_PAUSE_MS, position: maxScroll },
    }
  }
  return { scrollTo: next, state: { ...state, position: next } }
}

/**
 * Drives {@link nextScrollStep} off requestAnimationFrame. No-op while `active`
 * is false, so a viewer on a phone can take over by scrolling. The browser
 * pauses rAF on hidden tabs, which simply freezes the loop until it is on screen
 * again.
 */
export function useAutoScroll(active: boolean): void {
  useEffect(() => {
    if (!active) return

    let frame = 0
    let state: ScrollState = { ...INITIAL_SCROLL_STATE, position: window.scrollY }
    let last = performance.now()

    const tick = (now: number): void => {
      const elapsedSec = (now - last) / 1000
      last = now
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const result = nextScrollStep(state, now, elapsedSec, maxScroll)
      state = result.state
      if (result.scrollTo !== null) window.scrollTo(0, result.scrollTo)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active])
}
