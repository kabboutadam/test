import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { LatLng, BusPosition } from '../domain/types';
import { PositionsService } from './positions.service';

interface DriverGpsBody {
  location: LatLng;
  speedKmh?: number;
}

@Controller('positions')
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  /** Snapshot of every bus (used on app cold-start before the socket connects). */
  @Get()
  getAll(): BusPosition[] {
    return this.positions.getSnapshot();
  }

  @Get(':routeId')
  getForRoute(@Param('routeId') routeId: string): BusPosition | { error: string } {
    return this.positions.getForRoute(routeId) ?? { error: 'no position yet' };
  }

  /**
   * REST fallback for driver GPS when a socket isn't practical (e.g. background
   * location tasks that just POST). Same effect as the `driver:gps` socket event.
   */
  @Post(':routeId/gps')
  ingest(
    @Param('routeId') routeId: string,
    @Body() body: DriverGpsBody,
  ): { ok: boolean; position: BusPosition | null } {
    const position = this.positions.ingestGps(routeId, body.location, body.speedKmh);
    return { ok: position != null, position };
  }
}
