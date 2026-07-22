'use client'

import { useEffect, useState } from 'react'
import type { CivEvent } from '@/lib/types'
import { DEMO_WORTHY, TYPE_STYLES, summarize } from '@/lib/eventSummary'
import { useVillagerNames } from '@/lib/villagers'
import { StatusDot } from './StatusDot'

// Panel 5 — the story in plain English. The same SSE relay EventFeed uses, but
// filtered to demo-worthy events and rendered as sentences a non-technical
// recruiter follows. Each row keeps the real ledger event one click away (the
// "here's the actual event" beat for the engineers).
const FEED_CAP = 60

export function PlainEnglishFeed() {
  const [events, setEvents] = useState<CivEvent[]>([])
  const [connected, setConnected] = useState(false)
  const { data: names } = useVillagerNames()
  const table = names ?? {}

  useEffect(() => {
    const source = new EventSource('/api/events/events/stream')
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.addEventListener('event', (message) => {
      const parsed: CivEvent = JSON.parse((message as MessageEvent).data)
      if (!DEMO_WORTHY.has(parsed.eventType)) return
      setEvents((current) => [parsed, ...current].slice(0, FEED_CAP))
    })
    return () => source.close()
  }, [])

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <span className="text-sm font-medium uppercase tracking-wider text-zinc-400">Live activity</span>
        <span className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span>Redpanda → PostgreSQL ledger</span>
          <StatusDot ok={connected} />
        </span>
      </div>
      <ol className="min-h-0 flex-1 divide-y divide-zinc-800/60 overflow-y-auto">
        {events.length === 0 && <li className="p-4 text-sm text-zinc-500">Waiting for the race to begin…</li>}
        {events.map((event) => (
          <li key={event.eventId} className="px-4 py-1.5 text-sm">
            <div className="flex items-baseline gap-3">
              <time className="shrink-0 tabular-nums text-xs leading-6 text-zinc-500">
                {new Date(event.occurredAt).toLocaleTimeString()}
              </time>
              <span className="min-w-0 flex-1 truncate leading-6 text-zinc-200">{summarize(event, table)}</span>
              <span className={'shrink-0 font-mono text-[10px] leading-6 ' + (TYPE_STYLES[event.eventType] ?? 'text-zinc-500')}>
                {event.eventType}
              </span>
            </div>
            <details className="mt-0.5">
              <summary className="cursor-pointer list-none text-[10px] text-zinc-600 hover:text-zinc-400">
                raw ledger event ▾
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-950/80 p-2 text-[10px] leading-relaxed text-zinc-400">
                {JSON.stringify(event, null, 2)}
              </pre>
            </details>
          </li>
        ))}
      </ol>
    </div>
  )
}
