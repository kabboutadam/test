/**
 * Subscription gating. Access to live tracking is granted only while the
 * subscription is 'active' or in 'trial'. When a real billing provider is wired
 * in (Stripe, in-app purchase, or a local gateway like Areeba), replace the
 * mock plans and have `entitles()` read the verified receipt.
 */

import { Subscription } from '@/models/types';

export interface Plan {
  id: 'monthly' | 'yearly';
  label: string;
  priceUsd: number;
  cadence: string;
  perChildNote: string;
}

export const plans: Plan[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    priceUsd: 5,
    cadence: 'per month',
    perChildNote: 'Covers all children in one family account',
  },
  {
    id: 'yearly',
    label: 'Yearly',
    priceUsd: 48,
    cadence: 'per year',
    perChildNote: 'Two months free vs. monthly',
  },
];

/** True when the subscription currently unlocks live tracking. */
export function entitles(sub: Subscription): boolean {
  return sub.status === 'active' || sub.status === 'trial';
}

export function statusLabel(sub: Subscription): string {
  switch (sub.status) {
    case 'trial':
      return sub.renewsAt ? `Free trial · ends ${sub.renewsAt}` : 'Free trial';
    case 'active':
      return sub.renewsAt ? `Active · renews ${sub.renewsAt}` : 'Active';
    case 'expired':
      return 'Expired';
    case 'none':
      return 'No subscription';
  }
}

/** Simulate a successful purchase; returns the new subscription state. */
export function activate(planId: Plan['id']): Subscription {
  const renews = new Date();
  renews.setMonth(renews.getMonth() + (planId === 'yearly' ? 12 : 1));
  return {
    status: 'active',
    plan: planId,
    renewsAt: renews.toISOString().slice(0, 10),
  };
}
