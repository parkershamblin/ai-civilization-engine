'use client'

import { useEffect, useRef, useState } from 'react'

// Tweens toward `value` so the ledger counter visibly CLIMBS between polls
// instead of snapping — the always-climbing audit-trail number is the demo's
// headline, and motion sells it. Null renders an em dash (source down).
export function CountUp({ value, className }: { value: number | null; className?: string }) {
  const [display, setDisplay] = useState(value ?? 0)
  const fromRef = useRef(value ?? 0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (value == null) return
    const from = fromRef.current
    const to = value
    if (from === to) {
      setDisplay(to)
      return
    }
    const start = performance.now()
    const durationMs = 1300
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value])

  if (value == null) return <span className={className}>—</span>
  return (
    <span className={className} suppressHydrationWarning>
      {display.toLocaleString()}
    </span>
  )
}
