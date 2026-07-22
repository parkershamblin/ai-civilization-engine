'use client'

import { useDemoStats } from '@/lib/demoStats'
import { useVillagerNames } from '@/lib/villagers'
import { StatusDot } from './StatusDot'

// Panel 4 — the memory stream at work. Per-villager retrieval counts as bars,
// plus a live feed of recent pgvector searches (who / query / hits / latency).
// All of it comes from memory-service's in-memory ring; villager NAMES resolve
// here via agent-service (memory-service keys on ids only).
export function MemoryRetrievals() {
  const { data } = useDemoStats()
  const { data: names } = useVillagerNames()
  const retrievals = data?.retrievals ?? null
  const ok = data?.sources.memoryService !== 'error'
  const nameOf = (id: string) => names?.[id] ?? id.slice(0, 8)

  const perVillager = retrievals?.perVillager ?? []
  const maxCount = perVillager.length > 0 ? Math.max(...perVillager.map((v) => v.count), 1) : 1
  const sorted = [...perVillager].sort((a, b) => b.count - a.count)

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium uppercase tracking-wider text-zinc-400">Memory retrievals</span>
        <span className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span>pgvector</span>
          <StatusDot ok={ok} />
        </span>
      </div>

      <div className="mb-4 space-y-1.5">
        {sorted.length === 0 && <p className="text-xs text-zinc-600">no retrievals yet…</p>}
        {sorted.map((v) => (
          <div key={v.villagerId} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 truncate text-zinc-300">{nameOf(v.villagerId)}</span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-800">
              <div className="h-full rounded bg-violet-500/80" style={{ width: `${(v.count / maxCount) * 100}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right tabular-nums text-zinc-400">{v.count}</span>
          </div>
        ))}
      </div>

      <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">recent searches</div>
      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {(retrievals?.recent ?? []).length === 0 && <li className="text-xs text-zinc-600">waiting…</li>}
        {retrievals?.recent.map((r, i) => (
          <li key={`${r.at}-${i}`} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 truncate text-zinc-400">{nameOf(r.villagerId)}</span>
            <span className="min-w-0 flex-1 truncate italic text-zinc-500">“{r.queryPreview}”</span>
            <span className="shrink-0 tabular-nums text-zinc-500">{r.results} hits</span>
            <span className="w-14 shrink-0 text-right tabular-nums text-zinc-600">{Math.round(r.latencyMs)}ms</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
