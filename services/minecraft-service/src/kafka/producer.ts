import { Kafka, type Producer, logLevel } from 'kafkajs'
import type { EventEnvelope } from '@civ/events/ts'
import { logger } from '../logging.ts'
import { worldEventsEmitted } from '../metrics.ts'

export class EventProducer {
  private producer: Producer
  private worldEventHook: ((envelope: EventEnvelope) => void) | null = null

  constructor(brokers: string[]) {
    const kafka = new Kafka({ clientId: 'minecraft-service', brokers, logLevel: logLevel.WARN })
    this.producer = kafka.producer({ allowAutoTopicCreation: true })
  }

  /** Observe every world.events publish (RB-1: the milestone mapper's single
   *  choke point — a milestone can only summarize what really reached the
   *  ledger). The hook must never throw into the publish path. */
  onWorldEvent(hook: (envelope: EventEnvelope) => void): void {
    this.worldEventHook = hook
  }

  async connect(): Promise<void> {
    await this.producer.connect()
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect()
  }

  /** Publish one envelope; key = aggregateId keeps per-villager ordering. */
  async publish(topic: string, envelope: EventEnvelope): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ key: envelope.aggregateId, value: JSON.stringify(envelope) }],
    })
    worldEventsEmitted.inc({ type: envelope.eventType })
    logger.debug({ topic, eventType: envelope.eventType, eventId: envelope.eventId }, 'published')
    if (topic === 'world.events' && this.worldEventHook) {
      try {
        this.worldEventHook(envelope)
      } catch (err) {
        logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'world-event hook failed — publish unaffected')
      }
    }
  }
}
