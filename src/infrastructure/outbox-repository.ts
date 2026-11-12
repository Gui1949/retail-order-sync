import { Order } from '../domain/order.js';
import { OutboxMessage } from '../domain/outbox-message.js';

export interface ITransactionalOutboxRepository {
  saveOrderWithOutbox(order: Order, message: OutboxMessage): Promise<void>;
  findPendingMessages(limit?: number): Promise<OutboxMessage[]>;
  markAsPublished(messageId: string): Promise<void>;
  incrementRetry(messageId: string, error: string): Promise<void>;
  markAsDeadLetter(messageId: string, error: string): Promise<void>;
  getOrder(id: string): Promise<Order | null>;
  getAllMessages(): Promise<OutboxMessage[]>;
}

export class InMemoryTransactionalRepository implements ITransactionalOutboxRepository {
  private orders: Map<string, Order> = new Map();
  private outbox: Map<string, OutboxMessage> = new Map();

  async saveOrderWithOutbox(order: Order, message: OutboxMessage): Promise<void> {
    // Simulates an ACID transaction commit
    this.orders.set(order.id, { ...order });
    this.outbox.set(message.id, { ...message });
  }

  async findPendingMessages(limit: number = 50): Promise<OutboxMessage[]> {
    return Array.from(this.outbox.values())
      .filter((m) => m.status === 'PENDING' || (m.status === 'FAILED' && m.retryCount < m.maxRetries))
      .slice(0, limit);
  }

  async markAsPublished(messageId: string): Promise<void> {
    const msg = this.outbox.get(messageId);
    if (msg) {
      msg.status = 'PUBLISHED';
      msg.processedAt = new Date();
      this.outbox.set(messageId, msg);
    }
  }

  async incrementRetry(messageId: string, error: string): Promise<void> {
    const msg = this.outbox.get(messageId);
    if (msg) {
      msg.retryCount += 1;
      msg.lastError = error;
      msg.status = msg.retryCount >= msg.maxRetries ? 'DEAD_LETTER' : 'FAILED';
      this.outbox.set(messageId, msg);
    }
  }

  async markAsDeadLetter(messageId: string, error: string): Promise<void> {
    const msg = this.outbox.get(messageId);
    if (msg) {
      msg.status = 'DEAD_LETTER';
      msg.lastError = error;
      msg.processedAt = new Date();
      this.outbox.set(messageId, msg);
    }
  }

  async getOrder(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  async getAllMessages(): Promise<OutboxMessage[]> {
    return Array.from(this.outbox.values());
  }
}
