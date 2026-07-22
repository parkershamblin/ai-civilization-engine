'use client'

import { useQuery } from '@tanstack/react-query'

// Shared villagerId -> display-name resolver. Several demo panels need names
// (the feed, memory retrievals, the flagship card); memory/event-service key on
// ids only, so names resolve here via agent-service — the same lookup
// RaceScoreboard/VillagerGrid already do, hoisted so it is fetched once.
export function useVillagerNames() {
  return useQuery({
    queryKey: ['villager-names'],
    queryFn: async (): Promise<Record<string, string>> => {
      const res = await fetch('/api/agent/villagers')
      if (!res.ok) throw new Error(`agent-service ${res.status}`)
      const table: Record<string, string> = {}
      for (const v of (await res.json()) as Array<{ id: string; name: string }>) {
        table[v.id] = v.name
      }
      return table
    },
    staleTime: 5 * 60_000,
  })
}
