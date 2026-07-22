import { Inject, Injectable } from '@nestjs/common';

import { Subscription } from '../domain/types';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from './subscriptions.repository';

export interface Plan {
  id: 'monthly' | 'yearly';
  label: string;
  priceUsd: number;
  cadence: string;
}

export const PLANS: Plan[] = [
  { id: 'monthly', label: 'Monthly', priceUsd: 5, cadence: 'per month' },
  { id: 'yearly', label: 'Yearly', priceUsd: 48, cadence: 'per year' },
];

/**
 * Subscription state. `entitles()` is the single gate the parent app relies on;
 * back it with a verified receipt (Apple/Google IAP or a payment gateway) in
 * production.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repo: SubscriptionRepository,
  ) {}

  async getForParent(parentId: string): Promise<Subscription> {
    return (
      (await this.repo.getForParent(parentId)) ?? {
        parentId,
        status: 'none',
        plan: null,
        renewsAt: null,
      }
    );
  }

  async entitles(parentId: string): Promise<boolean> {
    const s = await this.getForParent(parentId);
    return s.status === 'active' || s.status === 'trial';
  }

  /** Simulate a successful purchase. Replace with verified-receipt handling. */
  async activate(parentId: string, planId: Plan['id']): Promise<Subscription> {
    const renews = new Date();
    renews.setMonth(renews.getMonth() + (planId === 'yearly' ? 12 : 1));
    const sub: Subscription = {
      parentId,
      status: 'active',
      plan: planId,
      renewsAt: renews.toISOString().slice(0, 10),
    };
    await this.repo.save(sub);
    return sub;
  }
}
