import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LatLng } from '../domain/types';
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
  constructor(private readonly positions: PositionsService) {}

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
