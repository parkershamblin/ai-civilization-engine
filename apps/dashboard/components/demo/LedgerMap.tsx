'use client'

import { useEffect, useRef, useState } from 'react'
import type { CivEvent } from '@/lib/types'
import { useVillagerNames } from '@/lib/villagers'
import { StatusDot } from './StatusDot'

// The 2D world view: racer positions plotted live from the SAME event ledger
// the win is judged from (VillagerMoved / VillagerSpawned carry x/z). This is
// the audit-trail story rendered as a picture — and, unlike prismarine-viewer
// on MC 1.21.6, it cannot crash the fleet: it is EventSource + <canvas>, the
// primitives EventFeed/RaceScoreboard already use safely.
const TEAM_COLOR: Record<string, string> = { red: '#ef4444', blue: '#0284c7' }
const NEUTRAL = '#71717a'
const TRAIL_MAX = 40
const MIN_SPAN = 64 // blocks — floor so a single/clustered fleet isn't a divide-by-zero

interface Dot {
  x: number
  z: number
  trail: { x: number; z: number }[]
}

export function LedgerMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dots = useRef<Map<string, Dot>>(new Map())
  const teams = useRef<Map<string, string>>(new Map())
  const [connected, setConnected] = useState(false)
  const { data: names } = useVillagerNames()
  const namesRef = useRef<Record<string, string>>({})
  namesRef.current = names ?? {}

  useEffect(() => {
    let live = true
    let raf = 0

    const upsert = (id: string, x: unknown, z: unknown) => {
      if (typeof x !== 'number' || typeof z !== 'number') return
      const d = dots.current.get(id)
      if (d) {
        d.x = x
        d.z = z
        d.trail.push({ x, z })
        if (d.trail.length > TRAIL_MAX) d.trail.shift()
      } else {
        dots.current.set(id, { x, z, trail: [{ x, z }] })
      }
    }

    const applyTeams = (payload: Record<string, any>) => {
      for (const t of (payload.teams ?? []) as Array<{ teamId: string; villagerIds: string[] }>) {
        for (const v of t.villagerIds) teams.current.set(v, t.teamId)
      }
    }

    async function bootstrap() {
      try {
        // teams from the newest AttemptStarted (store pages ascending, 100 cap)
        let started: CivEvent | undefined
        let cursor: string | null = null
        do {
          const url = `/api/events/events?type=AttemptStarted&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
          const page: { data: CivEvent[]; nextCursor: string | null } = await (await fetch(url)).json()
          if (page.data.length > 0) started = page.data.at(-1)
          cursor = page.nextCursor
        } while (cursor && live)
        if (started) applyTeams(started.payload as Record<string, any>)
      } catch {
        /* teams degrade to neutral dots */
      }

      // seed positions from the last 10 minutes: spawns first (idle bots), then
      // moves (their latest position wins because it is applied last).
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      for (const type of ['VillagerSpawned', 'VillagerMoved']) {
        let cursor: string | null = null
        try {
          do {
            const url = `/api/events/events?type=${type}&aggregate-type=Villager&since=${since}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
            const page: { data: CivEvent[]; nextCursor: string | null } = await (await fetch(url)).json()
            for (const e of page.data) {
              const p = e.payload as Record<string, any>
              const pos = type === 'VillagerMoved' ? p.to : p.position
              if (pos) upsert(p.villagerId, pos.x, pos.z)
            }
            cursor = page.nextCursor
          } while (cursor && live)
        } catch {
          /* one type failing still leaves the other */
        }
      }
    }

    const source = new EventSource('/api/events/events/stream')
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.addEventListener('event', (message) => {
      const e: CivEvent = JSON.parse((message as MessageEvent).data)
      const p = e.payload as Record<string, any>
      if (e.eventType === 'VillagerMoved' && p.to) upsert(p.villagerId, p.to.x, p.to.z)
      else if (e.eventType === 'VillagerSpawned' && p.position) upsert(p.villagerId, p.position.x, p.position.z)
      else if (e.eventType === 'AttemptStarted') applyTeams(p)
    })

    const draw = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const dpr = window.devicePixelRatio || 1
          const w = canvas.clientWidth
          const h = canvas.clientHeight
          if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
            canvas.width = Math.round(w * dpr)
            canvas.height = Math.round(h * dpr)
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx.clearRect(0, 0, w, h)

          const all = [...dots.current.values()]
          if (all.length > 0) {
            let minX = Infinity
            let maxX = -Infinity
            let minZ = Infinity
            let maxZ = -Infinity
            for (const d of all) {
              minX = Math.min(minX, d.x)
              maxX = Math.max(maxX, d.x)
              minZ = Math.min(minZ, d.z)
              maxZ = Math.max(maxZ, d.z)
            }
            if (maxX - minX < MIN_SPAN) {
              const c = (minX + maxX) / 2
              minX = c - MIN_SPAN / 2
              maxX = c + MIN_SPAN / 2
            }
            if (maxZ - minZ < MIN_SPAN) {
              const c = (minZ + maxZ) / 2
              minZ = c - MIN_SPAN / 2
              maxZ = c + MIN_SPAN / 2
            }
            const pad = 0.08
            const spanX = maxX - minX
            const spanZ = maxZ - minZ
            const scale = Math.min((w * (1 - 2 * pad)) / spanX, (h * (1 - 2 * pad)) / spanZ)
            const ox = (w - spanX * scale) / 2
            const oz = (h - spanZ * scale) / 2
            const px = (x: number) => ox + (x - minX) * scale
            const py = (z: number) => oz + (z - minZ) * scale

            for (const [id, d] of dots.current) {
              const color = TEAM_COLOR[teams.current.get(id) ?? ''] ?? NEUTRAL
              // fading trail
              ctx.globalAlpha = 0.35
              ctx.strokeStyle = color
              ctx.lineWidth = 1.5
              ctx.beginPath()
              d.trail.forEach((pt, i) => (i ? ctx.lineTo(px(pt.x), py(pt.z)) : ctx.moveTo(px(pt.x), py(pt.z))))
              ctx.stroke()
              ctx.globalAlpha = 1
              // dot
              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(px(d.x), py(d.z), 5, 0, Math.PI * 2)
              ctx.fill()
              // name label
              ctx.fillStyle = '#d4d4d8'
              ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
              ctx.fillText(namesRef.current[id] ?? id.slice(0, 6), px(d.x) + 8, py(d.z) + 4)
            }
          }
        }
      }
      if (live) raf = requestAnimationFrame(draw)
    }

    bootstrap()
    raf = requestAnimationFrame(draw)

    return () => {
      live = false
      cancelAnimationFrame(raf)
      source.close()
    }
  }, [])

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
      {dots.current.size === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-600">
          waiting for racer positions from the ledger…
        </div>
      )}
      <div className="pointer-events-none absolute right-3 top-3">
        <StatusDot ok={connected} />
      </div>
    </div>
  )
}
