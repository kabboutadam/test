import { Injectable } from '@nestjs/common';

import { subscriptions } from '../domain/seed';
import { Subscription } from '../domain/types';

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
  private readonly store = new Map<string, Subscription>(
    subscriptions.map((s) => [s.parentId, s]),
  );

  getForParent(parentId: string): Subscription {
    return (
      this.store.get(parentId) ?? {
        parentId,
        status: 'none',
        plan: null,
        renewsAt: null,
      }
    );
  }

  entitles(parentId: string): boolean {
    const s = this.getForParent(parentId);
    return s.status === 'active' || s.status === 'trial';
  }

  /** Simulate a successful purchase. Replace with verified-receipt handling. */
  activate(parentId: string, planId: Plan['id']): Subscription {
    const renews = new Date();
    renews.setMonth(renews.getMonth() + (planId === 'yearly' ? 12 : 1));
    const sub: Subscription = {
      parentId,
      status: 'active',
      plan: planId,
      renewsAt: renews.toISOString().slice(0, 10),
    };
    this.store.set(parentId, sub);
    return sub;
  }
}
