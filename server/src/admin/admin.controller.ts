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
import { distanceKm } from '../domain/geo';
import { normalizePhone } from '../domain/phone';
import { roadLegMinutes } from '../domain/routing';
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
  /** Optional — omit and the child joins the school's pickup list automatically. */
  routeId?: string;
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
  /** Move the child to another bus/list (route). */
  routeId?: string;
}
interface ArrangeBody {
  /** Which bus/list to arrange. Defaults to the school's first list. */
  routeId?: string;
  /** Child ids in pickup order (first picked up → last before school). */
  childIds: string[];
  /** "HH:MM" the bus should reach school by. Defaults to 07:30. */
  schoolArrival?: string;
  /** Average city speed for distance-based ETA (km/h). Defaults to 20. */
  avgSpeedKmh?: number;
  /** Minutes the bus waits at each pickup. Defaults to 1. */
  dwellMin?: number;
}

const CHILD_COLORS = ['#0B6E4F', '#C1440E', '#2A6F97', '#8E44AD', '#B7791F'];

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}
function formatHm(mins: number): string {
  const t = (((Math.round(mins) % 1440) + 1440) % 1440);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
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

    // Server-wide SMS status so the dashboard can warn when login codes aren't
    // actually being texted (default console mode).
    const twilio = process.env.SMS_PROVIDER === 'twilio';
    const sms = {
      mode: twilio ? 'twilio' : 'console',
      ready:
        twilio &&
        !!process.env.TWILIO_ACCOUNT_SID &&
        !!process.env.TWILIO_AUTH_TOKEN &&
        !!process.env.TWILIO_FROM,
    };

    return {
      school: school ?? null,
      routes: routeSummaries,
      totals: {
        routes: routes.length,
        buses: routeSummaries.filter((r) => r.plateNumber).length,
        children: routeSummaries.reduce((n, r) => n + r.childCount, 0),
      },
      sms,
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

  @Delete('routes/:id')
  async deleteRoute(
    @CurrentOperator() op: OperatorContext,
    @Param('id') id: string,
  ): Promise<{ ok: boolean }> {
    this.ownedRoute(id, op); // authorize: route belongs to this school
    if (this.fleet.getChildrenForRoute(id).length > 0) {
      throw new BadRequestException('move or remove this bus’s children first');
    }
    this.positions.unregisterRoute(id); // stop tracking
    await this.fleet.removeRoute(id); // also deletes any assigned vehicle/driver
    return { ok: true };
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

  /** The school's single pickup route, created on demand (school as destination)
   * so the school never has to think about "routes" — just kids. */
  private async schoolRoute(op: OperatorContext): Promise<Route> {
    const existing = this.fleet.getRoutesForSchool(op.schoolId)[0];
    if (existing) return existing;
    const school = this.fleet.getSchool(op.schoolId);
    const routeId = `route_${randomUUID().slice(0, 8)}`;
    const route = await this.fleet.addRoute({
      id: routeId,
      name: 'Pickup route',
      schoolId: op.schoolId,
      stops: [
        {
          id: `${routeId}_s0`,
          name: school?.name ?? 'School',
          order: 0,
          location: school?.location ?? { latitude: 0, longitude: 0 },
          travelMinutesFromPrev: 0,
          scheduledTime: '',
        },
      ],
    });
    this.positions.registerRoute(route.id);
    return route;
  }

  @Get('children')
  listChildren(@CurrentOperator() op: OperatorContext) {
    return this.fleet
      .getChildrenForSchool(op.schoolId)
      .map((c) => {
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
          order: stop?.order ?? 0,
          location: stop?.location ?? null,
          scheduledTime: stop?.scheduledTime || null,
          parentPhone: parent?.phone ?? null,
          parentName: parent?.name ?? null,
        };
      })
      .sort((a, b) => a.order - b.order);
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
    // Route is automatic: the school's pickup route (created on first child).
    const route = body.routeId
      ? this.ownedRoute(body.routeId, op)
      : await this.schoolRoute(op);

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
    let child = this.ownedChild(id, op);

    // Move the child to another bus/list: pull their stop out of the old route
    // and insert it before the new route's destination.
    if (body.routeId && body.routeId !== child.routeId) {
      const newRoute = this.ownedRoute(body.routeId, op);
      const oldRoute = this.fleet.getRoute(child.routeId);
      const existing = oldRoute?.stops.find((s) => s.id === child.stopId);
      if (oldRoute) {
        await this.fleet.updateRoute({
          ...oldRoute,
          stops: reindex(oldRoute.stops.filter((s) => s.id !== child.stopId)),
        });
      }
      const moved: Stop = existing
        ? { ...existing, scheduledTime: '' }
        : {
            id: child.stopId,
            name: child.address || child.name,
            order: 0,
            location: { latitude: body.latitude ?? 0, longitude: body.longitude ?? 0 },
            travelMinutesFromPrev: 5,
            scheduledTime: '',
          };
      const at = Math.max(0, newRoute.stops.length - 1);
      const ns = [...newRoute.stops];
      ns.splice(at, 0, moved);
      await this.fleet.updateRoute({ ...newRoute, stops: reindex(ns) });
      child = await this.fleet.updateChild({ ...child, routeId: newRoute.id });
    }

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

  /**
   * Arrange the school's kids into a pickup order and compute each one's time.
   * Reorders the route's pickup stops to `childIds`, estimates travel between
   * homes from straight-line distance / avg speed, and works backward from the
   * school-arrival time to give every child a pickup time.
   */
  @Post('arrange')
  async arrange(@CurrentOperator() op: OperatorContext, @Body() body: ArrangeBody) {
    const route = body.routeId
      ? this.ownedRoute(body.routeId, op)
      : this.fleet.getRoutesForSchool(op.schoolId)[0];
    if (!route) throw new NotFoundException('no pickup route yet — add a child first');

    const speed = body.avgSpeedKmh && body.avgSpeedKmh > 0 ? body.avgSpeedKmh : 20;
    const dwell = body.dwellMin != null && body.dwellMin >= 0 ? body.dwellMin : 1;
    const arrival =
      body.schoolArrival && /^\d{1,2}:\d{2}$/.test(body.schoolArrival)
        ? body.schoolArrival
        : '07:30';

    const kids = this.fleet
      .getChildrenForSchool(op.schoolId)
      .filter((c) => c.routeId === route.id);
    const stopById = new Map(route.stops.map((s) => [s.id, s]));
    const childStopIds = new Set(kids.map((c) => c.stopId));
    const stopForChild = new Map(kids.map((c) => [c.id, stopById.get(c.stopId)]));

    // Pickups in the requested order, then the destination (school) last.
    const pickups: Stop[] = [];
    for (const id of body.childIds) {
      const s = stopForChild.get(id);
      if (s) pickups.push(s);
    }
    const destination = route.stops.filter((s) => !childStopIds.has(s.id));
    const ordered = [...pickups, ...destination];
    if (ordered.length < 2) throw new BadRequestException('need at least one child');

    // Real road driving times (OSRM) between consecutive stops, falling back to
    // a straight-line distance estimate per leg if routing is unavailable.
    const legs = await roadLegMinutes(ordered.map((s) => s.location));
    const withTravel = ordered.map((s, i) => ({
      ...s,
      order: i,
      travelMinutesFromPrev:
        i === 0
          ? 0
          : legs
            ? legs[i - 1]
            : Math.max(1, Math.round((distanceKm(ordered[i - 1].location, s.location) / speed) * 60)),
    }));

    // Total trip time (travel + a dwell at each stop we depart), then back-fill
    // times so the last stop lands exactly on the school-arrival time.
    let total = 0;
    for (let i = 1; i < withTravel.length; i++) {
      total += dwell + withTravel[i].travelMinutesFromPrev;
    }
    const startMin = parseHm(arrival) - total;
    let acc = startMin;
    const timed = withTravel.map((s, i) => {
      if (i > 0) acc += dwell + s.travelMinutesFromPrev;
      return { ...s, scheduledTime: formatHm(acc) };
    });

    await this.fleet.updateRoute({ ...route, stops: timed });

    // Report each child's computed pickup time in order, plus whether the
    // travel came from real road data or the distance estimate fallback.
    const schedule = kids
      .map((c) => {
        const s = timed.find((t) => t.id === c.stopId);
        return { childId: c.id, name: c.name, order: s?.order ?? 0, scheduledTime: s?.scheduledTime ?? '' };
      })
      .sort((a, b) => a.order - b.order);
    return { mode: legs ? 'road' : 'estimate', schedule };
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
