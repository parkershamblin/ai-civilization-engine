'use client'

import type { ReactNode } from 'react'
import { useDemoStats } from '@/lib/demoStats'
import { CountUp } from './CountUp'

// Panel 6 numbers — big, honest, live. Each tile degrades to an em dash when
// its source is down (never a blank strip). Small tech badges name the stack
// under each figure for the engineers in the room.
function Stat({
  label,
  value,
  badge,
  hero = false,
}: {
  label: string
  value: ReactNode
  badge: string
  hero?: boolean
}) {
  return (
    <div className="flex flex-col">
      <span
        className={
          'tabular-nums font-semibold leading-none text-zinc-100 ' +
          (hero ? 'text-4xl text-emerald-300' : 'text-2xl')
        }
      >
        {value}
      </span>
      <span className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="mt-0.5 text-[10px] text-zinc-600">{badge}</span>
    </div>
  )
}

export function StatsStrip() {
  const { data } = useDemoStats()
  const s = data?.stats
  const n = (v?: number | null) => (v == null ? '—' : v.toLocaleString())
  const p50 = s?.retrievalP50Ms
  const p95 = s?.retrievalP95Ms

  return (
    <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
      <Stat label="agents online" value={n(s?.agentsOnline)} badge="mineflayer" />
      <Stat label="events / sec" value={s?.eventsPerSec == null ? '—' : s.eventsPerSec.toFixed(1)} badge="Redpanda" />
      <Stat label="events in ledger" hero value={<CountUp value={s?.totalLedgerEvents ?? null} />} badge="PostgreSQL" />
      <Stat label="memories stored" value={n(s?.memoriesStored)} badge="pgvector" />
      <Stat
        label="retrieval p50 / p95"
        value={p50 == null && p95 == null ? '—' : `${p50 ?? '—'} / ${p95 ?? '—'} ms`}
        badge="Prometheus"
      />
    </div>
  )
}
