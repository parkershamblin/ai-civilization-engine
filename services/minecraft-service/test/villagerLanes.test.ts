import { describe, expect, it } from 'vitest'
import { VillagerLanes } from '../src/kafka/villagerLanes.ts'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('VillagerLanes', () => {
  it('runs commands for different villagers concurrently (no cross-villager head-of-line)', async () => {
    const lanes = new VillagerLanes()
    const order: string[] = []
    let releaseSlow: () => void = () => {}
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve
    })

    // Villager A starts a slow action (a 60s gather, in spirit).
    const a = lanes.dispatch('villager-a', async () => {
      order.push('a-start')
      await slowGate
      order.push('a-end')
    })
    // Villager B's command arrives while A is mid-action — the RB-2 defect
    // was B waiting ~50s here because it shared A's partition.
    const b = lanes.dispatch('villager-b', async () => {
      order.push('b-done')
    })

    await b
    expect(order).toEqual(['a-start', 'b-done']) // B finished while A still runs
    releaseSlow()
    await a
    expect(order).toEqual(['a-start', 'b-done', 'a-end'])
  })

  it('keeps strict arrival order within one villager', async () => {
    const lanes = new VillagerLanes()
    const order: number[] = []
    const tasks = [1, 2, 3, 4].map((n) =>
      lanes.dispatch('fen', async () => {
        // Reverse-staggered sleeps: without serialization, 4 would finish first.
        await sleep((5 - n) * 5)
        order.push(n)
      }),
    )
    await Promise.all(tasks)
    expect(order).toEqual([1, 2, 3, 4])
  })

  it('a throwing task does not poison the lane', async () => {
    const lanes = new VillagerLanes()
    const order: string[] = []
    await lanes.dispatch('fen', async () => {
      throw new Error('executor bug — latch owed an emission')
    })
    await lanes.dispatch('fen', async () => {
      order.push('still-alive')
    })
    expect(order).toEqual(['still-alive'])
  })

  it('cleans up idle lanes but never orphans a chained dispatch', async () => {
    const lanes = new VillagerLanes()
    await lanes.dispatch('fen', async () => {})
    // The finally cleanup races the awaiter by one microtask — settle it.
    await sleep(0)
    expect(lanes.active).toBe(0)

    // Chain a second dispatch while the first still runs: cleanup of the
    // first must not delete the second's map entry.
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const first = lanes.dispatch('fen', () => gate)
    const second = lanes.dispatch('fen', async () => {})
    release()
    await Promise.all([first, second])
    await sleep(0)
    expect(lanes.active).toBe(0)
  })
})
