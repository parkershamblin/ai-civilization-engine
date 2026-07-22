// Server-side aggregator for the /demo dashboard. Fans out to Prometheus,
// event-service, memory-service, and the optional POV sidecar, and returns ONE
// JSON the page polls (~1.5s). Design rules it enforces:
//  - never 500: every sub-fetch is isolated (Promise.allSettled + per-fetch
//    timeout); a dead backend degrades ONE field to null, never the response.
//  - Prometheus's raw query API stays server-side (off the browser).
//  - PromQL aggregates because prometheus.yml scrapes every target twice
//    (run_mode=host + run_mode=compose); a stale duplicate must not double a
//    gauge nor break histogram_quantile.

export const dynamic = 'force-dynamic'

const PROMETHEUS = process.env.PROMETHEUS_URL ?? 'http://localhost:9090'
const MEMORY = process.env.MEMORY_SERVICE_URL ?? 'http://localhost:8002'
const EVENTS = process.env.EVENT_SERVICE_URL ?? 'http://localhost:8081'
const POV_SIDECAR = process.env.POV_SIDECAR_URL ?? 'http://localhost:3200'

const TIMEOUT_MS = 800
const PROBE_TIMEOUT_MS = 500

async function fetchJson(url: string, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json()
}

// Prometheus instant query -> single scalar (or null when there is no data).
async function promScalar(query: string): Promise<number | null> {
  const body = (await fetchJson(
    `${PROMETHEUS}/api/v1/query?query=${encodeURIComponent(query)}`,
  )) as { data?: { result?: Array<{ value?: [number, string] }> } }
  const result = body?.data?.result
  if (!Array.isArray(result) || result.length === 0) return null
  const v = Number(result[0]?.value?.[1])
  return Number.isFinite(v) ? v : null
}

// Prometheus instant query grouped by topic -> [{topic, rate}], rate-sorted.
async function promByTopic(query: string): Promise<Array<{ topic: string; rate: number }>> {
  const body = (await fetchJson(
    `${PROMETHEUS}/api/v1/query?query=${encodeURIComponent(query)}`,
  )) as { data?: { result?: Array<{ metric?: { topic?: string }; value?: [number, string] }> } }
  const result = body?.data?.result
  if (!Array.isArray(result)) return []
  return result
    .map((r) => ({ topic: String(r?.metric?.topic ?? 'unknown'), rate: Number(r?.value?.[1]) }))
    .filter((r) => Number.isFinite(r.rate))
    .sort((a, b) => b.rate - a.rate)
}

export async function GET() {
  const settled = await Promise.allSettled([
    /* 0 */ promScalar('max(civ_bot_sessions)'),
    /* 1 */ promScalar('sum(rate(civ_events_ingested_total[1m]))'),
    /* 2 */ promByTopic('sum by (topic) (rate(civ_events_ingested_total[1m]))'),
    /* 3 */ promScalar('histogram_quantile(0.5, sum by (le) (rate(civ_memory_retrieval_seconds_bucket[5m])))'),
    /* 4 */ promScalar('histogram_quantile(0.95, sum by (le) (rate(civ_memory_retrieval_seconds_bucket[5m])))'),
    /* 5 */ fetchJson(`${EVENTS}/events/count`),
    /* 6 */ fetchJson(`${MEMORY}/debug/retrievals`),
    /* 7 */ fetchJson(`${POV_SIDECAR}/`, PROBE_TIMEOUT_MS).then(
      () => true,
      () => false,
    ),
  ])

  const ok = (i: number) => settled[i].status === 'fulfilled'
  const val = <T>(i: number, fallback: T): T =>
    settled[i].status === 'fulfilled' ? ((settled[i] as PromiseFulfilledResult<T>).value ?? fallback) : fallback

  const p50 = val<number | null>(3, null)
  const p95 = val<number | null>(4, null)
  const count = val<{ count?: number } | null>(5, null)
  const retrievals = val<{
    total?: number
    recent?: unknown[]
    perVillager?: unknown[]
    memoriesStored?: number | null
  } | null>(6, null)
  const pov3dUp = val<boolean>(7, false)

  // Prometheus is "ok" if it answered at all (empty data is still reachable);
  // "error" only when every query to it was rejected (unreachable).
  const prometheusOk = [0, 1, 2, 3, 4].some((i) => ok(i))

  return Response.json({
    at: new Date().toISOString(),
    stats: {
      agentsOnline: val<number | null>(0, null),
      eventsPerSec: val<number | null>(1, null),
      eventsPerSecByTopic: ok(2) ? val<Array<{ topic: string; rate: number }>>(2, []) : null,
      totalLedgerEvents: count && typeof count.count === 'number' ? count.count : null,
      memoriesStored: retrievals && typeof retrievals.memoriesStored === 'number' ? retrievals.memoriesStored : null,
      retrievalP50Ms: p50 == null ? null : Math.round(p50 * 1000),
      retrievalP95Ms: p95 == null ? null : Math.round(p95 * 1000),
    },
    retrievals: retrievals
      ? {
          total: typeof retrievals.total === 'number' ? retrievals.total : 0,
          recent: Array.isArray(retrievals.recent) ? retrievals.recent : [],
          perVillager: Array.isArray(retrievals.perVillager) ? retrievals.perVillager : [],
        }
      : null,
    worldView: { pov3d: { up: pov3dUp, url: POV_SIDECAR } },
    sources: {
      prometheus: prometheusOk ? 'ok' : 'error',
      eventService: ok(5) ? 'ok' : 'error',
      memoryService: ok(6) ? 'ok' : 'error',
      povSidecar: pov3dUp ? 'ok' : 'error',
    },
  })
}
