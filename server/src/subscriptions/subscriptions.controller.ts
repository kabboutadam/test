import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { Subscription } from '../domain/types';
import { Plan, PLANS, SubscriptionsService } from './subscriptions.service';

interface ActivateBody {
  planId: Plan['id'];
}

@Controller()
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get('plans')
  getPlans(): Plan[] {
    return PLANS;
  }

  @Get('subscriptions/:parentId')
  getForParent(@Param('parentId') parentId: string): Subscription {
    return this.subs.getForParent(parentId);
  }

  @Post('subscriptions/:parentId')
  activate(
    @Param('parentId') parentId: string,
    @Body() body: ActivateBody,
  ): Subscription {
    return this.subs.activate(parentId, body.planId);
  }
}
