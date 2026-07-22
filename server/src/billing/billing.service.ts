import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { Subscription } from '../domain/types';
import { PLANS, Plan, SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
  CheckoutSession,
} from './payment-provider';
import { PAYMENT_REPOSITORY, PaymentRepository } from './payment.repository';
import { Payment } from './payment.types';

export interface CheckoutResult extends CheckoutSession {
  paymentId: string;
  amountUsd: number;
}

/**
 * Orchestrates payment → subscription. A checkout creates a *pending* payment;
 * the subscription only becomes active once that payment is *confirmed paid*.
 * The mock provider confirms synchronously; a real provider would confirm via a
 * webhook that also lands in `confirm()`.
 */
@Injectable()
export class BillingService {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly subs: SubscriptionsService,
  ) {}

  async createCheckout(parentId: string, planId: Plan['id']): Promise<CheckoutResult> {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) throw new BadRequestException('unknown plan');

    const payment: Payment = {
      id: `pay_${randomUUID().slice(0, 12)}`,
      parentId,
      planId: plan.id,
      amountUsd: plan.priceUsd,
      status: 'pending',
      provider: this.provider.name,
      providerRef: null,
      createdAt: new Date().toISOString(),
    };
    await this.payments.save(payment);

    const session = await this.provider.createCheckout({
      paymentId: payment.id,
      parentId,
      planId: plan.id,
      amountUsd: plan.priceUsd,
    });

    return { ...session, paymentId: payment.id, amountUsd: plan.priceUsd };
  }

  /**
   * Confirm a payment and, if paid, activate the subscription. Idempotent: a
   * payment already marked paid just returns the current subscription.
   */
  async confirm(parentId: string, paymentId: string): Promise<{ subscription: Subscription; payment: Payment }> {
    const payment = await this.payments.get(paymentId);
    if (!payment) throw new NotFoundException('payment not found');
    if (payment.parentId !== parentId) throw new ForbiddenException('not your payment');

    if (payment.status === 'paid') {
      return { subscription: await this.subs.getForParent(parentId), payment };
    }

    const result = await this.provider.confirm(`mock_${payment.id}`);
    if (!result.paid) {
      payment.status = 'failed';
      await this.payments.save(payment);
      throw new BadRequestException('payment not completed');
    }

    payment.status = 'paid';
    payment.providerRef = result.providerRef;
    await this.payments.save(payment);

    const subscription = await this.subs.activate(parentId, payment.planId);
    return { subscription, payment };
  }
}
