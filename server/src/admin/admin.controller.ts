import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { CurrentOperator, OperatorContext } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Bus, Route, Stop } from '../domain/types';
import { FleetService } from '../fleet/fleet.service';
import { PositionsService } from '../positions/positions.service';

interface StopInput {
  name: string;
  latitude: number;
  longitude: number;
  scheduledTime?: string;
  travelMinutesFromPrev?: number;
}
interface CreateRouteBody {
  name: string;
  stops: StopInput[];
}
interface CreateBusBody {
  plateNumber: string;
  driverName: string;
  driverPhone: string;
  routeId: string;
  capacity?: number;
}
interface UpdateBusBody {
  plateNumber?: string;
  driverName?: string;
  driverPhone?: string;
  capacity?: number;
}

/** Operator dashboard API. Everything is scoped to the operator's school. */
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly fleet: FleetService,
    private readonly positions: PositionsService,
  ) {}

  /** Load a route and assert it belongs to this operator's school. */
  private ownedRoute(routeId: string, op: OperatorContext): Route {
    const route = this.fleet.getRoute(routeId);
    if (!route) throw new NotFoundException('route not found');
    if (route.schoolId !== op.schoolId) {
      throw new ForbiddenException('route belongs to another school');
    }
    return route;
  }

  @Get('overview')
  overview(@CurrentOperator() op: OperatorContext) {
    const school = this.fleet.getSchool(op.schoolId);
    const routes = this.fleet.getRoutesForSchool(op.schoolId);

    const routeSummaries = routes.map((route) => {
      const bus = this.fleet.getBusByRoute(route.id);
      const children = this.fleet.getChildrenForRoute(route.id);
      return {
        id: route.id,
        name: route.name,
        stopCount: route.stops.length,
        childCount: children.length,
        busId: bus?.id ?? null,
        plateNumber: bus?.plateNumber ?? null,
        driverName: bus?.driverName ?? null,
        driverPhone: bus?.driverPhone ?? null,
      };
    });

    return {
      school: school ?? null,
      routes: routeSummaries,
      totals: {
        routes: routes.length,
        buses: routeSummaries.filter((r) => r.plateNumber).length,
        children: routeSummaries.reduce((n, r) => n + r.childCount, 0),
      },
    };
  }

  @Get('positions')
  livePositions(@CurrentOperator() op: OperatorContext) {
    const routes = this.fleet.getRoutesForSchool(op.schoolId);
    return routes.map((route) => {
      const p = this.positions.getForRoute(route.id);
      const i = p?.currentStopIndex ?? 0;
      return {
        routeId: route.id,
        routeName: route.name,
        status: p?.status ?? 'not_started',
        source: p?.source ?? null,
        speedKmh: p?.speedKmh ?? 0,
        currentStop: route.stops[i]?.name ?? null,
        nextStop: route.stops[i + 1]?.name ?? null,
        stopsTotal: route.stops.length,
        stopIndex: i,
        updatedAt: p?.updatedAt ?? null,
      };
    });
  }

  @Post('routes')
  async createRoute(
    @CurrentOperator() op: OperatorContext,
    @Body() body: CreateRouteBody,
  ): Promise<Route> {
    if (!body?.name?.trim()) throw new BadRequestException('name is required');
    if (!Array.isArray(body.stops) || body.stops.length < 2) {
      throw new BadRequestException('a route needs at least 2 stops');
    }

    const routeId = `route_${randomUUID().slice(0, 8)}`;
    const stops: Stop[] = body.stops.map((s, i) => {
      if (!s?.name?.trim() || typeof s.latitude !== 'number' || typeof s.longitude !== 'number') {
        throw new BadRequestException(`stop ${i + 1} needs name, latitude, longitude`);
      }
      return {
        id: `${routeId}_s${i}`,
        name: s.name.trim(),
        order: i,
        location: { latitude: s.latitude, longitude: s.longitude },
        travelMinutesFromPrev: i === 0 ? 0 : Math.max(0, s.travelMinutesFromPrev ?? 5),
        scheduledTime: s.scheduledTime ?? '',
      };
    });

    const route = await this.fleet.addRoute({
      id: routeId,
      name: body.name.trim(),
      schoolId: op.schoolId,
      stops,
    });
    this.positions.registerRoute(route.id); // start tracking it immediately
    return route;
  }

  @Post('buses')
  async createBus(
    @CurrentOperator() op: OperatorContext,
    @Body() body: CreateBusBody,
  ): Promise<Bus> {
    if (!body?.plateNumber?.trim() || !body.driverName?.trim() || !body.driverPhone?.trim()) {
      throw new BadRequestException('plateNumber, driverName and driverPhone are required');
    }
    this.ownedRoute(body.routeId, op);
    if (this.fleet.getBusByRoute(body.routeId)) {
      throw new BadRequestException('this route already has a bus');
    }
    return this.fleet.addBus({
      id: `bus_${randomUUID().slice(0, 8)}`,
      plateNumber: body.plateNumber.trim(),
      driverName: body.driverName.trim(),
      driverPhone: body.driverPhone.trim(),
      routeId: body.routeId,
      capacity: body.capacity ?? 24,
    });
  }

  @Patch('buses/:id')
  async updateBus(
    @CurrentOperator() op: OperatorContext,
    @Param('id') id: string,
    @Body() body: UpdateBusBody,
  ): Promise<Bus> {
    const bus = this.fleet.getBuses().find((b) => b.id === id);
    if (!bus) throw new NotFoundException('bus not found');
    this.ownedRoute(bus.routeId, op); // authorize via the bus's route/school
    return this.fleet.updateBus({
      ...bus,
      plateNumber: body.plateNumber?.trim() || bus.plateNumber,
      driverName: body.driverName?.trim() || bus.driverName,
      driverPhone: body.driverPhone?.trim() || bus.driverPhone,
      capacity: body.capacity ?? bus.capacity,
    });
  }
}
