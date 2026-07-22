// The live/reconnecting pill used across every demo panel (matches the
// EventFeed/RaceScoreboard idiom): emerald when the source is up, red when it
// is degraded. Identity is never colour-alone — the word is always present.
export function StatusDot({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={'flex items-center gap-1.5 text-xs ' + (ok ? 'text-emerald-400' : 'text-red-400')}>
      <span className={'h-2 w-2 rounded-full ' + (ok ? 'bg-emerald-400' : 'bg-red-400')} />
      {label ?? (ok ? 'live' : 'reconnecting')}
    </span>
  )
}
