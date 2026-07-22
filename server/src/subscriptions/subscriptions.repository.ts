import { Subscription } from '../domain/types';

export const SUBSCRIPTION_REPOSITORY = 'SUBSCRIPTION_REPOSITORY';

export interface SubscriptionRepository {
  getForParent(parentId: string): Promise<Subscription | null>;
  save(sub: Subscription): Promise<void>;
}
