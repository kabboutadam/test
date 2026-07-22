import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { CurrentParent } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Child, Subscription } from '../domain/types';
import { FleetService } from '../fleet/fleet.service';
import { Plan, SubscriptionsService } from '../subscriptions/subscriptions.service';

interface ActivateBody {
  planId: Plan['id'];
}

interface AddChildBody {
  name: string;
  grade: string;
  routeId: string;
  stopId: string;
  color?: string;
}

const CHILD_COLORS = ['#0B6E4F', '#C1440E', '#2A6F97', '#8E44AD', '#B7791F'];

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

  @Post('children')
  async addChild(
    @CurrentParent() parentId: string,
    @Body() body: AddChildBody,
  ): Promise<Child> {
    if (!body?.name?.trim() || !body.routeId || !body.stopId) {
      throw new BadRequestException('name, routeId and stopId are required');
    }
    const route = this.fleet.getRoute(body.routeId);
    if (!route) throw new BadRequestException('unknown route');
    if (!route.stops.some((s) => s.id === body.stopId)) {
      throw new BadRequestException('stop does not belong to route');
    }

    const child: Child = {
      id: `child_${randomUUID().slice(0, 8)}`,
      name: body.name.trim(),
      grade: body.grade?.trim() || '—',
      parentId,
      routeId: body.routeId,
      stopId: body.stopId,
      color:
        body.color ??
        CHILD_COLORS[this.fleet.getChildrenForParent(parentId).length % CHILD_COLORS.length],
    };
    return this.fleet.addChild(child);
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
