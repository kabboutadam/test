import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LatLng } from '../domain/types';
import { FleetService } from '../fleet/fleet.service';
import { PositionsService } from './positions.service';

interface GpsPoint {
  latitude: number;
  longitude: number;
  speedKmh?: number;
}
interface DriverPositionsBody {
  routeId: string;
  /** One or more readings, oldest first. Batching lets the background task
   * flush a few points at once. */
  points: GpsPoint[];
}

/**
 * HTTP ingestion of driver GPS — the counterpart to the socket `driver:gps`.
 *
 * Background location on a locked/mounted phone can't keep a socket alive, so
 * the driver app's background task POSTs here instead. Same authorization: a
 * driver token may only report for its own assigned route. Each point flows
 * through the same `ingestGps`, so parents and notifications update identically.
 */
@Controller('driver')
@UseGuards(JwtAuthGuard)
export class DriverController {
  constructor(
    private readonly positions: PositionsService,
    private readonly fleet: FleetService,
  ) {}

  /**
   * The driver's pickup manifest: the kids on their own route, in pickup order,
   * with each home address, scheduled time, and a parent phone to call if a
   * child isn't at the stop. Scoped to the driver's assigned route only.
   */
  @Get('manifest')
  manifest(@CurrentUser() user: AuthUser) {
    if (user.role !== 'driver') {
      throw new ForbiddenException('Driver account required');
    }
    const route = this.fleet.getRoute(user.routeId);
    if (!route) throw new NotFoundException('route not found');

    const kids = this.fleet.getChildrenForRoute(user.routeId);
    const stopById = new Map(route.stops.map((s) => [s.id, s]));
    const childStopIds = new Set(kids.map((c) => c.stopId));

    const pickups = kids
      .map((c) => {
        const stop = stopById.get(c.stopId);
        const parent = this.fleet.getParent(c.parentId);
        return {
          order: stop?.order ?? 0,
          name: c.name,
          grade: c.grade,
          address: c.address ?? stop?.name ?? null,
          scheduledTime: stop?.scheduledTime || null,
          parentPhone: parent?.phone ?? null,
          location: stop?.location ?? null,
        };
      })
      .sort((a, b) => a.order - b.order);

    // The destination (school) is the stop no child owns.
    const dest = route.stops.filter((s) => !childStopIds.has(s.id)).slice(-1)[0];
    return {
      routeName: route.name,
      pickups,
      destination: dest
        ? { name: dest.name, scheduledTime: dest.scheduledTime || null, location: dest.location }
        : null,
    };
  }

  @Post('positions')
  ingest(
    @CurrentUser() user: AuthUser,
    @Body() body: DriverPositionsBody,
  ): { ok: boolean; count: number } {
    if (user.role !== 'driver') {
      throw new ForbiddenException('Driver account required');
    }
    if (!body?.routeId || !Array.isArray(body.points) || body.points.length === 0) {
      throw new BadRequestException('routeId and at least one point are required');
    }
    // A driver may only report for the route their bus is assigned to.
    if (body.routeId !== user.routeId) {
      throw new ForbiddenException('route not assigned to this driver');
    }

    let count = 0;
    for (const p of body.points) {
      if (typeof p?.latitude !== 'number' || typeof p?.longitude !== 'number') continue;
      const location: LatLng = { latitude: p.latitude, longitude: p.longitude };
      if (this.positions.ingestGps(body.routeId, location, p.speedKmh) != null) count++;
    }
    return { ok: count > 0, count };
  }
}
