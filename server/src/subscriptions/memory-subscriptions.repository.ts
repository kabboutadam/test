import { subscriptions as seed } from '../domain/seed';
import { Subscription } from '../domain/types';
import { SubscriptionRepository } from './subscriptions.repository';

/** In-memory subscriptions seeded from the demo data. */
export class MemorySubscriptionRepository implements SubscriptionRepository {
  private readonly store = new Map<string, Subscription>(
    seed.map((s) => [s.parentId, s]),
  );

  async getForParent(parentId: string): Promise<Subscription | null> {
    return this.store.get(parentId) ?? null;
  }

  async save(sub: Subscription): Promise<void> {
    this.store.set(sub.parentId, sub);
  }
}
