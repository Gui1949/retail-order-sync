import { Order, OrderCreatedEvent, OrderItem } from '../domain/order.js';
import { OutboxMessage } from '../domain/outbox-message.js';
import { ITransactionalOutboxRepository } from '../infrastructure/outbox-repository.js';
import { randomUUID } from 'crypto';

export class OrderService {
  constructor(private readonly repository: ITransactionalOutboxRepository) {}

  async createOrder(customerId: string, items: OrderItem[]): Promise<Order> {
    const totalAmount = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
    const orderId = randomUUID();

    const order: Order = {
      id: orderId,
      customerId,
      items,
      totalAmount,
      status: 'CONFIRMED',
      createdAt: new Date(),
    };

    const eventPayload: OrderCreatedEvent = {
      eventType: 'ORDER_CREATED',
      orderId,
      customerId,
      totalAmount,
      occurredOn: new Date().toISOString(),
    };

    const outboxMessage: OutboxMessage = {
      id: randomUUID(),
      aggregateType: 'ORDER',
      aggregateId: orderId,
      eventType: 'ORDER_CREATED',
      payload: JSON.stringify(eventPayload),
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    };

    // Atomic write
    await this.repository.saveOrderWithOutbox(order, outboxMessage);
    return order;
  }
}
