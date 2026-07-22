'use client'

import { StatusDot } from './StatusDot'

// Panel 1 — the hook. Phase 3 fills this slot with a live 2D ledger map
// (racer positions plotted from VillagerMoved events) plus an optional,
// crash-contained 3D prismarine-viewer overlay that auto-fails-over to the
// map. This is the Phase-2 labeled placeholder.
export function WorldViewSlot() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <span className="text-sm font-medium uppercase tracking-wider text-zinc-400">Live world</span>
        <span className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span>reconstructed from the ledger</span>
          <StatusDot ok label="2D map" />
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-zinc-600">
        Live bird&apos;s-eye map — racer positions plotted from <code className="text-zinc-500">VillagerMoved</code>{' '}
        ledger events. (Phase 3)
      </div>
    </div>
  )
}
