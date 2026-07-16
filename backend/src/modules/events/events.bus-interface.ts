// Experience Core — Domain Event Bus Interface
// Implementaciones: InMemory, Redis, RabbitMQ, Kafka

export interface DomainEventBus {
  emit(event: string, payload: any): Promise<void>;
  on(event: string, handler: (payload: any) => void | Promise<void>): void;
  off(event: string, handler: (payload: any) => void | Promise<void>): void;
  size(): number;
}
