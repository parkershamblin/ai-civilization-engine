import { StatsStrip } from '@/components/demo/StatsStrip'
import { WorldViewSlot } from '@/components/demo/WorldViewSlot'
import { RacePanel } from '@/components/demo/RacePanel'
import { ThroughputPanel } from '@/components/demo/ThroughputPanel'
import { MemoryRetrievals } from '@/components/demo/MemoryRetrievals'
import { PlainEnglishFeed } from '@/components/demo/PlainEnglishFeed'

// Parker's portfolio/resume link. Swap for the real URL.
const PORTFOLIO_URL = '#'

/**
 * The recruiter-facing single-screen demo. Composed for a 1920x1080 capture:
 * a title + one-line pitch, a live stats strip led by the always-climbing
 * ledger counter, the world view as the visual anchor, the race, event
 * throughput, memory retrievals, and a plain-English activity feed. Every
 * panel is self-fetching and degrades to a reconnecting state — nothing here
 * can take down the fleet.
 */
export default function DemoPage() {
  return (
    <main className="mx-auto max-w-[1880px] px-6 py-5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">AI Civilization Engine</h1>
          <p className="mt-1 text-sm text-zinc-300">
            Autonomous LLM villagers surviving and racing in Minecraft — no human input.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Parker Shamblin ·{' '}
            <a href={PORTFOLIO_URL} className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300">
              portfolio
            </a>
          </p>
        </div>
        <StatsStrip />
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <div className="h-[560px]">
            <WorldViewSlot />
          </div>
        </section>

        <section className="flex flex-col gap-4 lg:col-span-5">
          <RacePanel />
          <div className="flex-1">
            <ThroughputPanel />
          </div>
        </section>

        <section className="lg:col-span-4">
          <div className="h-[340px]">
            <MemoryRetrievals />
          </div>
        </section>

        <section className="lg:col-span-8">
          <div className="h-[340px]">
            <PlainEnglishFeed />
          </div>
        </section>
      </div>
    </main>
  )
}
