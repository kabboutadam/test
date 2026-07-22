import type { PrismaClient } from '@prisma/client';

import { Subscription, SubscriptionStatus } from '../domain/types';
import { SubscriptionRepository } from './subscriptions.repository';

/** Postgres-backed subscriptions via Prisma. */
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getForParent(parentId: string): Promise<Subscription | null> {
    const row = await this.prisma.subscription.findUnique({ where: { parentId } });
    if (!row) return null;
    return {
      parentId: row.parentId,
      status: row.status as SubscriptionStatus,
      plan: (row.plan as Subscription['plan']) ?? null,
      renewsAt: row.renewsAt ?? null,
    };
  }

  async save(sub: Subscription): Promise<void> {
    await this.prisma.subscription.upsert({
      where: { parentId: sub.parentId },
      update: { status: sub.status, plan: sub.plan, renewsAt: sub.renewsAt },
      create: {
        parentId: sub.parentId,
        status: sub.status,
        plan: sub.plan,
        renewsAt: sub.renewsAt,
      },
    });
  }
}
