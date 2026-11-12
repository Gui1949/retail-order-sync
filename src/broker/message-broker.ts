export interface IMessageBroker {
  publish(topic: string, routingKey: string, message: unknown): Promise<boolean>;
  publishToDLQ(topic: string, message: unknown, reason: string): Promise<boolean>;
}

export class InMemoryRabbitMQBroker implements IMessageBroker {
  public publishedMessages: Array<{ topic: string; routingKey: string; message: unknown }> = [];
  public deadLetterQueue: Array<{ topic: string; message: unknown; reason: string }> = [];
  public simulateFailure: boolean = false;

  async publish(topic: string, routingKey: string, message: unknown): Promise<boolean> {
    if (this.simulateFailure) {
      throw new Error(`RabbitMQ connection timeout to topic: ${topic}`);
    }
    this.publishedMessages.push({ topic, routingKey, message });
    return true;
  }

  async publishToDLQ(topic: string, message: unknown, reason: string): Promise<boolean> {
    this.deadLetterQueue.push({ topic, message, reason });
    return true;
  }
}
