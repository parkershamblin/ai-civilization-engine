import type { CivEvent } from '@/lib/types'

// Ledger events -> plain-English sentences for the /demo activity feed. This is
// the demo-facing, name-resolving cousin of EventFeed's terse summarize() — it
// reads as narration a non-technical recruiter follows, while the raw event
// stays one <details> click away.

// Hue per event family: emerald = world progress, red = danger, amber = social,
// sky = race boundary, violet = cognition.
export const TYPE_STYLES: Record<string, string> = {
  ProgressionMilestone: 'text-emerald-300',
  AttemptStarted: 'text-sky-300',
  AttemptEnded: 'text-sky-300',
  ThreatEncountered: 'text-red-400',
  HazardEncountered: 'text-red-300',
  ResourceGathered: 'text-emerald-400',
  VillagerTalked: 'text-amber-300',
  VillagerSpawned: 'text-emerald-300',
  DecisionMade: 'text-violet-300',
}

// What a recruiter should see: milestones (the hero), drama (threats/hazards),
// resource progress, race boundaries, and personality (chat). The high-rate
// per-tick noise (moves, every decision, raw action acks) is left out on
// purpose so the feed reads as a story.
export const DEMO_WORTHY = new Set<string>([
  'ProgressionMilestone',
  'AttemptStarted',
  'AttemptEnded',
  'ThreatEncountered',
  'HazardEncountered',
  'ResourceGathered',
  'VillagerTalked',
])

const MILESTONE_LABELS: Record<string, string> = {
  first_coal: 'mined first coal',
  first_iron_ore: 'mined first iron ore',
  furnace_placed: 'placed a furnace',
  first_ingot: 'smelted first iron',
  iron_pickaxe: 'crafted the IRON PICKAXE',
}

// 660.6 -> "11:00.6"
export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  const m = Math.floor(seconds / 60)
  const rem = (seconds - m * 60).toFixed(1).padStart(4, '0')
  return `${m}:${rem}`
}

function threatSentence(who: string, p: Record<string, unknown>): string {
  const t = (p.threatType as string) ?? 'threat'
  switch (p.phase) {
    case 'killed':
      return `${who} was killed by a ${t}`
    case 'overwhelmed':
      return `${who} was overwhelmed by ${t}`
    case 'escaped':
      return `${who} escaped a ${t}`
    case 'engaged':
      return `${who} is fighting a ${t}`
    default:
      return `${who} spotted a ${t}`
  }
}

export function summarize(event: CivEvent, names: Record<string, string> = {}): string {
  const p = event.payload as Record<string, any>
  const who = (id?: string) => (id ? (names[id] ?? id.slice(0, 8)) : 'someone')
  switch (event.eventType) {
    case 'ProgressionMilestone':
      return `${who(p.villagerId)} of ${p.teamId} — ${p.detail ?? MILESTONE_LABELS[p.milestone] ?? p.milestone}`
    case 'AttemptStarted':
      return `Race started — ${p.difficulty}${p.label ? ` · ${p.label}` : ''}`
    case 'AttemptEnded':
      return p.outcome === 'won'
        ? `Race won by team ${p.winningTeamId} in ${fmtDuration(p.durationSeconds)}`
        : `Race ended — ${p.outcome}`
    case 'ThreatEncountered':
      return threatSentence(who(p.villagerId), p)
    case 'HazardEncountered':
      return `${who(p.villagerId)} — ${p.detail ?? `${p.hazardType} (${p.phase})`}`
    case 'ResourceGathered':
      return `${who(p.villagerId)} gathered ${p.quantity ?? ''} ${p.resourceType ?? ''}`.replace(/\s+/g, ' ').trim()
    case 'VillagerTalked':
      return `${who(p.villagerId)}: “${p.message}”`
    case 'VillagerSpawned':
      return `${p.name ?? who(p.villagerId)} joined the world`
    case 'DecisionMade':
      return `${who(p.villagerId)}: ${p.reasoning ?? p.decision ?? ''}`
    default:
      return event.eventType
  }
}
