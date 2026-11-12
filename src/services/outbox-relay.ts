import { ITransactionalOutboxRepository } from '../infrastructure/outbox-repository.js';
import { IMessageBroker } from '../broker/message-broker.js';

export interface RelayResult {
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}

export class OutboxRelayWorker {
  constructor(
    private readonly repository: ITransactionalOutboxRepository,
    private readonly broker: IMessageBroker,
    private readonly topic: string = 'orders.events'
  ) {}

  async processPendingMessages(batchSize: number = 20): Promise<RelayResult> {
    const messages = await this.repository.findPendingMessages(batchSize);
    const result: RelayResult = {
      processed: messages.length,
      succeeded: 0,
      failed: 0,
      deadLettered: 0,
    };

    for (const msg of messages) {
      try {
        const payload = JSON.parse(msg.payload);
        const routingKey = `order.${msg.eventType.toLowerCase()}`;

        await this.broker.publish(this.topic, routingKey, payload);
        await this.repository.markAsPublished(msg.id);
        result.succeeded += 1;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const willDeadLetter = msg.retryCount + 1 >= msg.maxRetries;

        await this.repository.incrementRetry(msg.id, errorMessage);

        if (willDeadLetter) {
          await this.broker.publishToDLQ(
            `${this.topic}.dlq`,
            JSON.parse(msg.payload),
            `Exceeded max retries (${msg.maxRetries}): ${errorMessage}`
          );
          result.deadLettered += 1;
        } else {
          result.failed += 1;
        }
      }
    }

    return result;
  }
}
