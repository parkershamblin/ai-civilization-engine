'use client'

import { useQuery } from '@tanstack/react-query'

// Shape of /api/demo/stats — the single server-side aggregator. Every field is
// independently nullable: a down backend degrades its own numbers to null while
// the rest stay live (the demo never hard-crashes).

export interface DemoStatsNumbers {
  agentsOnline: number | null
  eventsPerSec: number | null
  eventsPerSecByTopic: { topic: string; rate: number }[] | null
  totalLedgerEvents: number | null
  memoriesStored: number | null
  retrievalP50Ms: number | null
  retrievalP95Ms: number | null
}

export interface RetrievalEntry {
  villagerId: string
  queryPreview: string
  k: number
  results: number
  latencyMs: number
  at: string
}

export interface DemoRetrievals {
  total: number
  recent: RetrievalEntry[]
  perVillager: { villagerId: string; count: number }[]
}

export type SourceStatus = 'ok' | 'error'

export interface DemoStatsResponse {
  at: string
  stats: DemoStatsNumbers
  retrievals: DemoRetrievals | null
  worldView: { pov3d: { up: boolean; url: string } }
  sources: {
    prometheus: SourceStatus
    eventService: SourceStatus
    memoryService: SourceStatus
    povSidecar: SourceStatus
  }
}

async function fetchDemoStats(): Promise<DemoStatsResponse> {
  const res = await fetch('/api/demo/stats')
  if (!res.ok) throw new Error(`demo stats ${res.status}`)
  return res.json()
}

// Polls the aggregator on the ~1.5s demo cadence. staleTime 0 so a reconnecting
// backend's recovery shows up on the next tick.
export function useDemoStats() {
  return useQuery({
    queryKey: ['demo-stats'],
    queryFn: fetchDemoStats,
    refetchInterval: 1500,
    staleTime: 0,
  })
}
