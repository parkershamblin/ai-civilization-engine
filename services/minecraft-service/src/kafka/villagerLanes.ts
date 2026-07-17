import { logger } from '../logging.ts'

/**
 * Per-villager dispatch lanes (RB-2 defect fix): commands for DIFFERENT
 * villagers run concurrently; commands for the SAME villager run strictly in
 * arrival order.
 *
 * Why: per-villager ordering only requires same-KEY serialization, but the
 * consumer's unit of serialization is the PARTITION. Six race bots hash into
 * six partitions imperfectly (measured 2026-07-17: two doubled partitions,
 * one of them cross-team) — so one villager's 60s gather stalled a rival's
 * commands ~50s and the backlog then failed in same-second bursts. A lane per
 * villagerId removes cross-villager head-of-line blocking for ANY partition
 * layout, with no topic migration.
 *
 * Semantics traded, deliberately: eachMessage now returns on ENQUEUE, so
 * offsets commit before queued commands execute — a crash loses at most the
 * few seconds of queued intents. That loss is benign here by design: the
 * brain re-decides every tick, the executor's staleness guard already drops
 * old intents (COMMAND_MAX_AGE_SECONDS), and dedupe suppresses replays. The
 * watchdog bounds each task, so a lane advances even when an action hangs.
 */
export class VillagerLanes {
  private readonly tails = new Map<string, Promise<void>>()

  /** Number of villagers with work queued or running (test + metrics seam). */
  get active(): number {
    return this.tails.size
  }

  dispatch(key: string, task: () => Promise<void>): Promise<void> {
    const previous = this.tails.get(key) ?? Promise.resolve()
    // A task failure must not poison the lane: the executor owns its own
    // exactly-one-outcome latch, so anything thrown past it is a bug to log —
    // the next command still runs.
    const tail = previous.then(async () => {
      try {
        await task()
      } catch (err) {
        logger.error(
          { villagerId: key, err: err instanceof Error ? err.message : String(err) },
          'lane task threw past the executor — outcome latch owed an emission',
        )
      }
    })
    const tracked: Promise<void> = tail.finally(() => {
      // Only the CURRENT tail cleans up — a later dispatch has already
      // replaced the map entry, and deleting it would orphan that chain.
      if (this.tails.get(key) === tracked) {
        this.tails.delete(key)
      }
    })
    this.tails.set(key, tracked)
    return tracked
  }
}
