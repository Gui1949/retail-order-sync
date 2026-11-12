import { InMemoryTransactionalRepository } from './infrastructure/outbox-repository.js';
import { InMemoryRabbitMQBroker } from './broker/message-broker.js';
import { OrderService } from './services/order-service.js';
import { OutboxRelayWorker } from './services/outbox-relay.js';

async function main() {
  console.log('🚀 Iniciando demonstração do Transactional Outbox Pattern');

  const repository = new InMemoryTransactionalRepository();
  const broker = new InMemoryRabbitMQBroker();
  const orderService = new OrderService(repository);
  const relayWorker = new OutboxRelayWorker(repository, broker);

  // 1. Criar pedido e registrar na outbox atomicamente
  console.log('\n📦 1. Criando novo pedido corporativo...');
  const order = await orderService.createOrder('cust-9871', [
    { sku: 'SRV-MSSQL-LIC', quantity: 2, unitPrice: 1500 },
    { sku: 'RABBITMQ-CLUSTER', quantity: 1, unitPrice: 3200 },
  ]);
  console.log(`✅ Pedido criado com sucesso: ${order.id} | Total: R$ ${order.totalAmount}`);

  // 2. Verificar mensagens pendentes no outbox
  const pending = await repository.findPendingMessages();
  console.log(`\n📬 2. Mensagens no Outbox prontas para envio: ${pending.length}`);
  console.log(`   ID da Mensagem: ${pending[0].id}`);
  console.log(`   Status: ${pending[0].status}`);

  // 3. Executar o worker de relay para despachar para o RabbitMQ
  console.log('\n⚡ 3. Executando Outbox Relay Worker...');
  const result = await relayWorker.processPendingMessages();
  console.log(`✅ Resultado do Relay:`, result);

  // 4. Conferir status no broker
  console.log(`\n📡 4. Mensagens entregues com sucesso no Broker: ${broker.publishedMessages.length}`);
  console.log(`   Tópico: ${broker.publishedMessages[0]?.topic}`);
  console.log(`   Routing Key: ${broker.publishedMessages[0]?.routingKey}`);
  console.log(`   Payload entregue:`, broker.publishedMessages[0]?.message);

  console.log('\n🎉 Demonstração finalizada com resiliência garantida!');
}

main().catch(console.error);
