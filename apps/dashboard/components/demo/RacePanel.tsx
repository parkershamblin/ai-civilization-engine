'use client'

import { useEffect, useState } from 'react'
import type { CivEvent } from '@/lib/types'
import { RaceScoreboard } from '@/components/RaceScoreboard'
import { FLAGSHIP_ATTEMPT_ID, FlagshipResultCard } from './FlagshipResultCard'

// Panel 2 switch: the live RaceScoreboard while a real race is running, else
// the seeded flagship result card. A race is "live" when the newest attempt is
// not the flagship and has no AttemptEnded yet. A new AttemptStarted arriving
// on the stream always flips to live; a finishing race keeps showing (its win
// banner is the payoff), so we never flip back to the card mid-session.
export function RacePanel() {
  const [mode, setMode] = useState<'loading' | 'live' | 'flagship'>('loading')

  useEffect(() => {
    let live = true

    async function decide() {
      try {
        let started: CivEvent | undefined
        let cursor: string | null = null
        do {
          const url = `/api/events/events?type=AttemptStarted&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
          const page: { data: CivEvent[]; nextCursor: string | null } = await (await fetch(url)).json()
          if (page.data.length > 0) started = page.data.at(-1)
          cursor = page.nextCursor
        } while (cursor)

        if (!started) {
          if (live) setMode('flagship')
          return
        }
        const attemptId = (started.payload as Record<string, any>).attemptId as string
        if (attemptId === FLAGSHIP_ATTEMPT_ID) {
          if (live) setMode('flagship')
          return
        }
        const endedUrl = `/api/events/events?type=AttemptEnded&aggregate-type=Attempt&aggregate-id=${attemptId}&limit=1`
        const ended: { data: CivEvent[] } = await (await fetch(endedUrl)).json()
        if (live) setMode(ended.data.length === 0 ? 'live' : 'flagship')
      } catch {
        if (live) setMode('flagship')
      }
    }

    decide()

    const source = new EventSource('/api/events/events/stream')
    source.addEventListener('event', (message) => {
      const event: CivEvent = JSON.parse((message as MessageEvent).data)
      if (event.eventType === 'AttemptStarted' && (event.payload as Record<string, any>).attemptId !== FLAGSHIP_ATTEMPT_ID) {
        setMode('live')
      }
    })

    return () => {
      live = false
      source.close()
    }
  }, [])

  if (mode === 'live') return <RaceScoreboard />
  if (mode === 'flagship') return <FlagshipResultCard />
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-sm text-zinc-500">Loading race…</div>
  )
}
