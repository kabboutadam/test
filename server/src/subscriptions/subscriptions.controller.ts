import { Controller, Get } from '@nestjs/common';

import { Plan, PLANS } from './subscriptions.service';

/** Public plan catalog. Per-parent subscription lives under /me (guarded). */
@Controller()
export class SubscriptionsController {
  @Get('plans')
  getPlans(): Plan[] {
    return PLANS;
  }
}
