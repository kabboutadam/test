import { Payment } from './payment.types';

export const PAYMENT_REPOSITORY = 'PAYMENT_REPOSITORY';

export interface PaymentRepository {
  save(payment: Payment): Promise<void>;
  get(id: string): Promise<Payment | null>;
}

/** In-memory payments — the zero-infra default. */
export class MemoryPaymentRepository implements PaymentRepository {
  private readonly store = new Map<string, Payment>();
  async save(payment: Payment): Promise<void> {
    this.store.set(payment.id, payment);
  }
  async get(id: string): Promise<Payment | null> {
    return this.store.get(id) ?? null;
  }
}
