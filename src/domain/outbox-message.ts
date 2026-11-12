export type OutboxStatus = 'PENDING' | 'PUBLISHED' | 'FAILED' | 'DEAD_LETTER';

export interface OutboxMessage {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: string; // JSON serialized
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  createdAt: Date;
  processedAt?: Date;
}
