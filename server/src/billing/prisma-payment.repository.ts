import type { PrismaClient } from '@prisma/client';

import { PaymentRepository } from './payment.repository';
import { Payment, PaymentStatus } from './payment.types';

/** Postgres-backed payments via Prisma. */
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(payment: Payment): Promise<void> {
    await this.prisma.payment.upsert({
      where: { id: payment.id },
      update: {
        status: payment.status,
        provider: payment.provider,
        providerRef: payment.providerRef,
      },
      create: {
        id: payment.id,
        parentId: payment.parentId,
        planId: payment.planId,
        amountUsd: payment.amountUsd,
        status: payment.status,
        provider: payment.provider,
        providerRef: payment.providerRef,
        createdAt: payment.createdAt,
      },
    });
  }

  async get(id: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      parentId: row.parentId,
      planId: row.planId as Payment['planId'],
      amountUsd: row.amountUsd,
      status: row.status as PaymentStatus,
      provider: row.provider,
      providerRef: row.providerRef ?? null,
      createdAt: row.createdAt,
    };
  }
}
