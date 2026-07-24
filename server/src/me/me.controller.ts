import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { CurrentParent } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Child, Subscription } from '../domain/types';
import { FleetService } from '../fleet/fleet.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

interface AddChildBody {
  name: string;
  grade: string;
  routeId: string;
  stopId: string;
  color?: string;
}

interface UpdateChildBody {
  name?: string;
  grade?: string;
  routeId?: string;
  stopId?: string;
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

  @Patch('children/:id')
  async updateChild(
    @CurrentParent() parentId: string,
    @Param('id') id: string,
    @Body() body: UpdateChildBody,
  ): Promise<Child> {
    const child = this.fleet.getChild(id);
    if (!child) throw new NotFoundException('child not found');
    if (child.parentId !== parentId) throw new ForbiddenException('not your child');

    const routeId = body.routeId ?? child.routeId;
    const stopId = body.stopId ?? child.stopId;
    const route = this.fleet.getRoute(routeId);
    if (!route) throw new BadRequestException('unknown route');
    if (!route.stops.some((s) => s.id === stopId)) {
      throw new BadRequestException('stop does not belong to route');
    }

    return this.fleet.updateChild({
      ...child,
      name: body.name?.trim() || child.name,
      grade: body.grade?.trim() || child.grade,
      routeId,
      stopId,
    });
  }

  @Delete('children/:id')
  async removeChild(
    @CurrentParent() parentId: string,
    @Param('id') id: string,
  ): Promise<{ ok: boolean }> {
    const child = this.fleet.getChild(id);
    if (!child) throw new NotFoundException('child not found');
    if (child.parentId !== parentId) throw new ForbiddenException('not your child');
    await this.fleet.removeChild(id);
    return { ok: true };
  }

  @Get('subscription')
  getSubscription(@CurrentParent() parentId: string): Promise<Subscription> {
    return this.subs.getForParent(parentId);
  }
  // Subscriptions activate only through a confirmed payment — see /me/billing.
}
