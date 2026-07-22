export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface Payment {
  id: string;
  parentId: string;
  planId: 'monthly' | 'yearly';
  amountUsd: number;
  status: PaymentStatus;
  /** Which provider handled it (e.g. 'mock', 'stripe', 'areeba'). */
  provider: string;
  /** Provider's transaction/charge reference, set once paid. */
  providerRef: string | null;
  createdAt: string;
}
