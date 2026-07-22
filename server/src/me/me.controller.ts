import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Child, Subscription } from '../domain/types';
import { FleetService } from '../fleet/fleet.service';
import { Plan, SubscriptionsService } from '../subscriptions/subscriptions.service';

interface ActivateBody {
  planId: Plan['id'];
}

/** Everything scoped to the authenticated parent. Requires a Bearer token. */
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly fleet: FleetService,
    private readonly subs: SubscriptionsService,
  ) {}

  @Get('children')
  getChildren(@CurrentUser() user: AuthUser): Child[] {
    return this.fleet.getChildrenForParent(user.parentId);
  }

  @Get('subscription')
  getSubscription(@CurrentUser() user: AuthUser): Promise<Subscription> {
    return this.subs.getForParent(user.parentId);
  }

  @Post('subscription')
  activate(
    @CurrentUser() user: AuthUser,
    @Body() body: ActivateBody,
  ): Promise<Subscription> {
    return this.subs.activate(user.parentId, body.planId);
  }
}
