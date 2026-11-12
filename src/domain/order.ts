export interface OrderItem {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdAt: Date;
}

export interface OrderCreatedEvent {
  eventType: 'ORDER_CREATED';
  orderId: string;
  customerId: string;
  totalAmount: number;
  occurredOn: string;
}
