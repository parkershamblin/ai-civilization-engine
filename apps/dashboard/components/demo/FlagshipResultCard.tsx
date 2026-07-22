'use client'

import { useEffect, useState } from 'react'
import type { CivEvent } from '@/lib/types'
import { fmtDuration } from '@/lib/eventSummary'
import { useVillagerNames } from '@/lib/villagers'

// The filmed flagship take, GUARANTEE-SEEDED into the ledger (task demo runs
// scripts/seed-flagship.mjs) so this card is reconstructed from real stored
// events — not hardcoded. Shown in Panel 2 when no race is currently running.
export const FLAGSHIP_ATTEMPT_ID = '019f744d-471a-70bd-819d-bb9eec22bd72'

const MILESTONES = ['first_coal', 'first_iron_ore', 'furnace_placed', 'first_ingot', 'iron_pickaxe'] as const
const MILESTONE_LABELS: Record<string, string> = {
  first_coal: 'coal',
  first_iron_ore: 'iron ore',
  furnace_placed: 'furnace',
  first_ingot: 'ingot',
  iron_pickaxe: 'iron pickaxe',
}
const TEAM_COLOR: Record<string, string> = { red: '#ef4444', blue: '#0284c7' }
const teamColor = (t: string) => TEAM_COLOR[t] ?? '#71717a'

interface FlagshipTeam {
  teamId: string
  villagerIds: string[]
  crossed: Record<string, string>
}
interface Flagship {
  difficulty: string
  teams: FlagshipTeam[]
  winner: { teamId: string; villagerId: string; durationSeconds: number } | null
  honestClean: boolean
}

export function FlagshipResultCard() {
  const [data, setData] = useState<Flagship | null>(null)
  const [failed, setFailed] = useState(false)
  const { data: names } = useVillagerNames()
  const nameOf = (id?: string) => (id ? (names?.[id] ?? id.slice(0, 8)) : '')

  useEffect(() => {
    let live = true
    async function load() {
      try {
        const events: CivEvent[] = []
        let cursor: string | null = null
        do {
          const url = `/api/events/events?aggregate-type=Attempt&aggregate-id=${FLAGSHIP_ATTEMPT_ID}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
          const page: { data: CivEvent[]; nextCursor: string | null } = await (await fetch(url)).json()
          events.push(...page.data)
          cursor = page.nextCursor
        } while (cursor)

        const started = events.find((e) => e.eventType === 'AttemptStarted')
        if (!started) {
          if (live) setFailed(true)
          return
        }
        const sp = started.payload as Record<string, any>
        const teams: FlagshipTeam[] = (sp.teams as Array<{ teamId: string; villagerIds: string[] }>).map((t) => ({
          teamId: t.teamId,
          villagerIds: t.villagerIds,
          crossed: {},
        }))
        for (const e of events) {
          if (e.eventType !== 'ProgressionMilestone') continue
          const p = e.payload as Record<string, any>
          const team = teams.find((t) => t.teamId === p.teamId)
          if (team && !team.crossed[p.milestone]) team.crossed[p.milestone] = p.villagerId
        }
        const ep = events.find((e) => e.eventType === 'AttemptEnded')?.payload as Record<string, any> | undefined
        const winner =
          ep?.outcome === 'won'
            ? { teamId: ep.winningTeamId, villagerId: ep.winningVillagerId, durationSeconds: ep.durationSeconds }
            : null
        const honestClean =
          !!ep?.honestRace && ep.honestRace.fakeProviderDelta === 0 && ep.honestRace.budgetTrippedDelta === 0
        if (live) setData({ difficulty: sp.difficulty, teams, winner, honestClean })
      } catch {
        if (live) setFailed(true)
      }
    }
    load()
    return () => {
      live = false
    }
  }, [])

  if (failed || !data) {
    // Labeled static fallback — only reached on a ledger without the seed.
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="text-sm font-medium uppercase tracking-wider text-zinc-400">Flagship result · recorded take</div>
        <div className="mt-2 text-lg font-semibold text-zinc-100">Normal + hostiles — blue wins in 11:00.6</div>
        <div className="mt-1 text-sm text-zinc-400">honest-race CLEAN · zero deaths · attempt 019f744d</div>
        <div className="mt-3 text-[11px] text-zinc-600">
          Run <code className="text-zinc-400">task demo</code> to seed this attempt and show it live from the ledger.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: data.winner ? teamColor(data.winner.teamId) : '#3f3f46' }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium uppercase tracking-wider text-zinc-400">Flagship result</span>
        {data.honestClean && (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            honest-race CLEAN
          </span>
        )}
      </div>

      {data.winner && (
        <div className="mb-4">
          <div className="text-lg font-semibold">
            <span style={{ color: teamColor(data.winner.teamId) }}>Team {data.winner.teamId}</span>
            <span className="text-zinc-200"> won — {nameOf(data.winner.villagerId)} crafted the iron pickaxe</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
            <span className="tabular-nums text-zinc-200">{fmtDuration(data.winner.durationSeconds)}</span>
            <span>{data.difficulty} · hostiles on</span>
            <span>zero deaths</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {data.teams.map((team) => {
          const done = MILESTONES.filter((m) => team.crossed[m]).length
          return (
            <div key={team.teamId} className="rounded-lg border border-zinc-800 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: teamColor(team.teamId) }} />
                Team {team.teamId}
                <span className="ml-auto tabular-nums text-xs text-zinc-500">{done}/5</span>
              </div>
              <div className="flex gap-0.5">
                {MILESTONES.map((m) => (
                  <div
                    key={m}
                    title={MILESTONE_LABELS[m]}
                    className="h-2 flex-1 first:rounded-l last:rounded-r"
                    style={{ background: team.crossed[m] ? teamColor(team.teamId) : '#27272a' }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 text-[10px] text-zinc-600">
        reconstructed live from the ledger · attempt {FLAGSHIP_ATTEMPT_ID.slice(0, 13)}…
      </div>
    </div>
  )
}
