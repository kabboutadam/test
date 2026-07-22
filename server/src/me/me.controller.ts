import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentParent } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Child, Subscription } from '../domain/types';
import { FleetService } from '../fleet/fleet.service';
import { Plan, SubscriptionsService } from '../subscriptions/subscriptions.service';

interface ActivateBody {
  planId: Plan['id'];
}

/** Everything scoped to the authenticated parent. Requires a parent token. */
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly fleet: FleetService,
    private readonly subs: SubscriptionsService,
  ) {}

  @Get('children')
  getChildren(@CurrentParent() parentId: string): Child[] {
    return this.fleet.getChildrenForParent(parentId);
  }

  @Get('subscription')
  getSubscription(@CurrentParent() parentId: string): Promise<Subscription> {
    return this.subs.getForParent(parentId);
  }

  @Post('subscription')
  activate(
    @CurrentParent() parentId: string,
    @Body() body: ActivateBody,
  ): Promise<Subscription> {
    return this.subs.activate(parentId, body.planId);
  }
}
