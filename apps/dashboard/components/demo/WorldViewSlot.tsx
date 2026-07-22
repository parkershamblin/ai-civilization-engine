'use client'

import { useEffect, useState } from 'react'
import { useDemoStats } from '@/lib/demoStats'
import { LedgerMap } from './LedgerMap'
import { StatusDot } from './StatusDot'

// Panel 1 — the hook, and a swappable slot. The 2D ledger map is the always-on
// default (safe, always works). The 3D prismarine-viewer is an OPT-IN overlay
// that only appears when the isolated spectator sidecar is up — and because the
// sidecar is a separate process that crashes on the MC 1.21.6 particle packet,
// the up/down signal comes from the server-side aggregator's probe (not a
// cross-origin iframe error). If it drops, we fail over to the map within one
// poll. The map stays mounted underneath so swap-back is instant.
export function WorldViewSlot() {
  const { data } = useDemoStats()
  const pov3dUp = data?.worldView.pov3d.up ?? false
  const pov3dUrl = data?.worldView.pov3d.url ?? ''
  const [mode, setMode] = useState<'2d' | '3d'>('2d')

  // automatic failover: the sidecar died (or was never up) -> force the map
  useEffect(() => {
    if (!pov3dUp && mode === '3d') setMode('2d')
  }, [pov3dUp, mode])

  const showing3d = mode === '3d' && pov3dUp

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <span className="text-sm font-medium uppercase tracking-wider text-zinc-400">Live world</span>
        <div className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span>{showing3d ? 'prismarine-viewer' : 'reconstructed from the ledger'}</span>
          {pov3dUp && (
            <button
              type="button"
              onClick={() => setMode((m) => (m === '2d' ? '3d' : '2d'))}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
            >
              {mode === '2d' ? '3D view →' : '← 2D map'}
            </button>
          )}
          <StatusDot ok label={showing3d ? '3D live' : '2D map'} />
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {/* 2D always mounted: its SSE + accumulated positions persist so a
            swap back from 3D is instant. Hidden (not unmounted) under the 3D. */}
        <div className={showing3d ? 'invisible absolute inset-0' : 'absolute inset-0'}>
          <LedgerMap />
        </div>
        {showing3d && (
          <iframe
            src={pov3dUrl}
            title="3D spectator view"
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
      </div>
    </div>
  )
}
