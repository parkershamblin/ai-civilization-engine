'use client'

import { useDemoStats } from '@/lib/demoStats'
import { CountUp } from './CountUp'
import { StatusDot } from './StatusDot'

// Panel 3 — the audit-trail story. A big count-up "events in ledger" number
// leads (the number that only ever grows), with per-topic events/sec bars
// underneath so you can see the pipeline breathing.
export function ThroughputPanel() {
  const { data } = useDemoStats()
  const total = data?.stats.totalLedgerEvents ?? null
  const byTopic = data?.stats.eventsPerSecByTopic ?? null
  const eventServiceOk = data?.sources.eventService !== 'error'
  const promOk = data?.sources.prometheus !== 'error'
  const max = byTopic && byTopic.length > 0 ? Math.max(...byTopic.map((t) => t.rate), 0.001) : 1

  return (
    <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium uppercase tracking-wider text-zinc-400">Event pipeline</span>
        <span className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span>Redpanda</span>
          <span>event-service</span>
          <StatusDot ok={eventServiceOk} label={eventServiceOk ? 'live' : 'reconnecting'} />
        </span>
      </div>

      <div className="mb-1 text-4xl font-semibold tabular-nums text-emerald-300">
        <CountUp value={total} />
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        events in the append-only ledger — every milestone is a stored event with a causation chain. Nothing here is a
        screenshot.
      </p>

      <div className="mt-auto space-y-1.5">
        <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500">
          <span>events / sec by topic</span>
          {!promOk && <span className="text-red-400">metrics reconnecting</span>}
        </div>
        {byTopic == null && <p className="text-xs text-zinc-600">waiting for Prometheus…</p>}
        {byTopic != null && byTopic.length === 0 && <p className="text-xs text-zinc-600">idle — no events flowing</p>}
        {byTopic?.map((t) => (
          <div key={t.topic} className="flex items-center gap-2 text-xs">
            <span className="w-40 shrink-0 truncate font-mono text-zinc-400">{t.topic}</span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-800">
              <div
                className="h-full rounded bg-sky-500/80"
                style={{ width: `${Math.max(2, (t.rate / max) * 100)}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right tabular-nums text-zinc-400">{t.rate.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
