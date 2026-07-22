import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { CurrentParent } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Subscription } from '../domain/types';
import { Plan } from '../subscriptions/subscriptions.service';
import { BillingService, CheckoutResult } from './billing.service';

interface CheckoutBody {
  planId: Plan['id'];
}
interface ConfirmBody {
  paymentId: string;
}

/** Parent billing. Subscriptions activate only through a confirmed payment. */
@UseGuards(JwtAuthGuard)
@Controller('me/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  checkout(
    @CurrentParent() parentId: string,
    @Body() body: CheckoutBody,
  ): Promise<CheckoutResult> {
    return this.billing.createCheckout(parentId, body.planId);
  }

  @Post('confirm')
  async confirm(
    @CurrentParent() parentId: string,
    @Body() body: ConfirmBody,
  ): Promise<Subscription> {
    const { subscription } = await this.billing.confirm(parentId, body.paymentId);
    return subscription;
  }
}
