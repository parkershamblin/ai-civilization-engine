import { Kafka, type Consumer, logLevel } from 'kafkajs'
import type { EventEnvelope } from '@civ/events/ts'
import { logger } from '../logging.ts'
import type { CommandExecutor } from '../actions/executor.ts'
import { VillagerLanes } from './villagerLanes.ts'

/**
 * The single executor group for commands.minecraft. Parses envelopes and hands
 * them to the CommandExecutor, which owns dedupe, the timeout watchdog, and
 * the exactly-one-outcome invariant. Partitions are consumed concurrently, and
 * WITHIN a partition commands fan out to per-villager lanes (villagerLanes.ts):
 * same villager = strict arrival order, different villagers = concurrent even
 * when they hash to the same partition. Partition order alone is NOT the
 * per-villager guarantee anymore — the lane is.
 */
export class CommandConsumer {
  private consumer: Consumer
  private readonly lanes = new VillagerLanes()

  constructor(
    brokers: string[],
    private readonly executor: CommandExecutor,
  ) {
    const kafka = new Kafka({ clientId: 'minecraft-service', brokers, logLevel: logLevel.WARN })
    this.consumer = kafka.consumer({
      groupId: 'minecraft-service.command-executor',
      // Pathfinder A* runs synchronously on this same event loop, and a burst
      // of hard path computations delays heartbeats past the 30s default —
      // the coordinator then evicts a perfectly healthy member ("coordinator
      // is not aware of this member" rejoin churn, measured 8/session). 60s
      // of missed 3s heartbeats is a real death, not a busy loop.
      sessionTimeout: 60_000,
      rebalanceTimeout: 90_000,
    })
  }

  async start(): Promise<void> {
    // A consumer that dies quietly leaves a healthy-looking container with a
    // frozen world (M1-8's connect storm did exactly that). If kafkajs won't
    // self-restart, fail LOUD and let the restart policy recover — a restart
    // is visible in `docker ps`; a zombie isn't.
    this.consumer.on(this.consumer.events.CRASH, ({ payload }) => {
      logger.error({ err: payload.error?.message, willRestart: payload.restart }, 'kafka consumer crashed')
      if (!payload.restart) {
        process.exit(1)
      }
    })
    await this.consumer.connect()
    await this.consumer.subscribe({ topic: 'commands.minecraft' })
    await this.consumer.run({
      // Matches the provisioned partition count (M2-4, scripts/provision-topics.mjs)
      // so no partition ever waits behind another villager's slow action.
      partitionsConsumedConcurrently: 6,
      eachMessage: async ({ message }) => {
        const raw = message.value?.toString()
        if (!raw) {
          return
        }
        let envelope: EventEnvelope
        try {
          envelope = JSON.parse(raw) as EventEnvelope
        } catch {
          logger.warn({ raw: raw.slice(0, 200) }, 'parked non-JSON command')
          return
        }
        if (envelope.eventType !== 'ActionRequested') {
          logger.warn({ eventType: envelope.eventType }, 'parked non-command on commands.minecraft')
          return
        }
        // Enqueue, don't await: a slow action must only block ITS villager's
        // lane, never partition-mates. Offset semantics and the crash-loss
        // trade are documented on VillagerLanes.
        const villagerId =
          typeof (envelope.payload as { villagerId?: unknown })?.villagerId === 'string'
            ? (envelope.payload as { villagerId: string }).villagerId
            : envelope.aggregateId
        void this.lanes.dispatch(villagerId, () => this.executor.execute(envelope))
      },
    })
    logger.info('command consumer running')
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect()
  }
}
