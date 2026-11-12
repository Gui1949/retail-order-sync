import { describe, it } from 'node:test';
import assert from 'node:assert';
import { InMemoryTransactionalRepository } from '../infrastructure/outbox-repository.js';
import { InMemoryRabbitMQBroker } from '../broker/message-broker.js';
import { OrderService } from '../services/order-service.js';
import { OutboxRelayWorker } from '../services/outbox-relay.js';

describe('Transactional Outbox Pattern Suite', () => {
  it('deve persistir pedido e evento no outbox atomicamente', async () => {
    const repository = new InMemoryTransactionalRepository();
    const orderService = new OrderService(repository);

    const order = await orderService.createOrder('cust-123', [
      { sku: 'NODE-COURSE', quantity: 1, unitPrice: 200 },
    ]);

    assert.ok(order.id);
    assert.strictEqual(order.totalAmount, 200);

    const pending = await repository.findPendingMessages();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].aggregateId, order.id);
    assert.strictEqual(pending[0].status, 'PENDING');
  });

  it('deve publicar mensagens pendentes no broker e atualizar status para PUBLISHED', async () => {
    const repository = new InMemoryTransactionalRepository();
    const broker = new InMemoryRabbitMQBroker();
    const orderService = new OrderService(repository);
    const relayWorker = new OutboxRelayWorker(repository, broker);

    await orderService.createOrder('cust-123', [
      { sku: 'RABBITMQ-BOOK', quantity: 2, unitPrice: 80 },
    ]);

    const result = await relayWorker.processPendingMessages();
    assert.strictEqual(result.succeeded, 1);
    assert.strictEqual(result.failed, 0);

    assert.strictEqual(broker.publishedMessages.length, 1);
    assert.strictEqual(broker.publishedMessages[0].topic, 'orders.events');
    assert.strictEqual(broker.publishedMessages[0].routingKey, 'order.order_created');

    const pendingAfter = await repository.findPendingMessages();
    assert.strictEqual(pendingAfter.length, 0);

    const allMessages = await repository.getAllMessages();
    assert.strictEqual(allMessages[0].status, 'PUBLISHED');
  });

  it('deve retentar mensagens em caso de falha de conexão e enviar para DLQ ao atingir limite', async () => {
    const repository = new InMemoryTransactionalRepository();
    const broker = new InMemoryRabbitMQBroker();
    const orderService = new OrderService(repository);
    const relayWorker = new OutboxRelayWorker(repository, broker);

    await orderService.createOrder('cust-456', [
      { sku: 'DATADOG-APM', quantity: 1, unitPrice: 1200 },
    ]);

    // Simular indisponibilidade no broker
    broker.simulateFailure = true;

    // Tentativa 1
    const res1 = await relayWorker.processPendingMessages();
    assert.strictEqual(res1.failed, 1);

    // Tentativa 2
    const res2 = await relayWorker.processPendingMessages();
    assert.strictEqual(res2.failed, 1);

    // Tentativa 3 (atinge o limite maxRetries = 3 -> envia para DLQ)
    const res3 = await relayWorker.processPendingMessages();
    assert.strictEqual(res3.deadLettered, 1);

    assert.strictEqual(broker.deadLetterQueue.length, 1);
    assert.strictEqual(broker.deadLetterQueue[0].topic, 'orders.events.dlq');

    const all = await repository.getAllMessages();
    assert.strictEqual(all[0].status, 'DEAD_LETTER');
  });
});
