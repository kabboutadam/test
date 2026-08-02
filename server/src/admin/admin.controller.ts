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

import { CurrentOperator, OperatorContext } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { normalizePhone } from '../domain/phone';
import { Bus, Child, Route, Stop } from '../domain/types';
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
  /** Optional. Omit for the simple app flow — the school is auto-set as the
   * destination and each child's pin fills in the pickup stops. */
  stops?: StopInput[];
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
interface AddChildBody {
  name: string;
  grade?: string;
  routeId: string;
  latitude: number;
  longitude: number;
  address?: string;
  scheduledTime?: string;
  parentPhone: string;
  parentName?: string;
}
interface UpdateChildBody {
  name?: string;
  grade?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  scheduledTime?: string;
}

const CHILD_COLORS = ['#0B6E4F', '#C1440E', '#2A6F97', '#8E44AD', '#B7791F'];

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

    const routeId = `route_${randomUUID().slice(0, 8)}`;
    let stops: Stop[];
    if (Array.isArray(body.stops) && body.stops.length > 0) {
      // Full definition (web dashboard): explicit stops with coordinates.
      stops = body.stops.map((s, i) => {
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
    } else {
      // Simple app flow: name only. Seed the school as the destination stop;
      // each child added later inserts their pickup pin before it.
      const school = this.fleet.getSchool(op.schoolId);
      stops = [
        {
          id: `${routeId}_s0`,
          name: school?.name ?? 'School',
          order: 0,
          location: school?.location ?? { latitude: 0, longitude: 0 },
          travelMinutesFromPrev: 0,
          scheduledTime: '',
        },
      ];
    }

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

  // --- Children (each school manages only its own kids) ---

  /** Load a child and assert it belongs to this operator's school. */
  private ownedChild(id: string, op: OperatorContext): Child {
    const child = this.fleet.getChild(id);
    if (!child) throw new NotFoundException('child not found');
    if (child.schoolId !== op.schoolId) {
      throw new ForbiddenException('child belongs to another school');
    }
    return child;
  }

  @Get('children')
  listChildren(@CurrentOperator() op: OperatorContext) {
    return this.fleet.getChildrenForSchool(op.schoolId).map((c) => {
      const route = this.fleet.getRoute(c.routeId);
      const stop = route?.stops.find((s) => s.id === c.stopId);
      const parent = this.fleet.getParent(c.parentId);
      return {
        id: c.id,
        name: c.name,
        grade: c.grade,
        address: c.address ?? null,
        routeId: c.routeId,
        routeName: route?.name ?? null,
        location: stop?.location ?? null,
        scheduledTime: stop?.scheduledTime ?? null,
        parentPhone: parent?.phone ?? null,
        parentName: parent?.name ?? null,
      };
    });
  }

  @Post('children')
  async addChild(
    @CurrentOperator() op: OperatorContext,
    @Body() body: AddChildBody,
  ): Promise<Child> {
    if (!body?.name?.trim()) throw new BadRequestException('name is required');
    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      throw new BadRequestException('a pickup pin (latitude, longitude) is required');
    }
    if (!body.parentPhone?.trim()) {
      throw new BadRequestException('parentPhone is required so the parent can log in');
    }
    const route = this.ownedRoute(body.routeId, op);

    // The child's home pin becomes a pickup stop, inserted before the route's
    // final stop (its destination — typically the school).
    const stop: Stop = {
      id: `${route.id}_s${randomUUID().slice(0, 6)}`,
      name: body.address?.trim() || body.name.trim(),
      order: 0, // set by reindex below
      location: { latitude: body.latitude, longitude: body.longitude },
      travelMinutesFromPrev: 5,
      scheduledTime: body.scheduledTime?.trim() || '',
    };
    const insertAt = Math.max(0, route.stops.length - 1);
    const stops = [...route.stops];
    stops.splice(insertAt, 0, stop);
    await this.fleet.updateRoute({ ...route, stops: reindex(stops) });
    this.positions.registerRoute(route.id);

    const parent = await this.fleet.findOrCreateParentByPhone(
      body.parentPhone,
      body.parentName,
    );

    return this.fleet.addChild({
      id: `child_${randomUUID().slice(0, 8)}`,
      name: body.name.trim(),
      grade: body.grade?.trim() || '—',
      parentId: parent.id,
      schoolId: op.schoolId,
      routeId: route.id,
      stopId: stop.id,
      address: body.address?.trim() || undefined,
      color: CHILD_COLORS[this.fleet.getChildrenForSchool(op.schoolId).length % CHILD_COLORS.length],
    });
  }

  @Patch('children/:id')
  async updateChild(
    @CurrentOperator() op: OperatorContext,
    @Param('id') id: string,
    @Body() body: UpdateChildBody,
  ): Promise<Child> {
    const child = this.ownedChild(id, op);
    const route = this.fleet.getRoute(child.routeId);

    // Move the pickup pin if new coordinates are given.
    if (
      route &&
      typeof body.latitude === 'number' &&
      typeof body.longitude === 'number'
    ) {
      const stops = route.stops.map((s) =>
        s.id === child.stopId
          ? {
              ...s,
              location: { latitude: body.latitude!, longitude: body.longitude! },
              name: body.address?.trim() || s.name,
              scheduledTime: body.scheduledTime?.trim() || s.scheduledTime,
            }
          : s,
      );
      await this.fleet.updateRoute({ ...route, stops });
    }

    return this.fleet.updateChild({
      ...child,
      name: body.name?.trim() || child.name,
      grade: body.grade?.trim() || child.grade,
      address: body.address?.trim() ?? child.address,
    });
  }

  @Delete('children/:id')
  async removeChild(
    @CurrentOperator() op: OperatorContext,
    @Param('id') id: string,
  ): Promise<{ ok: boolean }> {
    this.ownedChild(id, op); // authorize before removing
    await this.fleet.removeChild(id);
    return { ok: true };
  }
}

/** Renumber a stop list so order === index and the first hop has 0 travel. */
function reindex(stops: Stop[]): Stop[] {
  return stops.map((s, i) => ({
    ...s,
    order: i,
    travelMinutesFromPrev: i === 0 ? 0 : s.travelMinutesFromPrev || 5,
  }));
}
