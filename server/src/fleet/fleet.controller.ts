import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import { Bus, Route } from '../domain/types';
import { FleetService } from './fleet.service';

/** Public fleet reference data. Parent-specific data lives under /me (guarded). */
@Controller()
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  @Get('routes')
  getRoutes(): Route[] {
    return this.fleet.getRoutes();
  }

  @Get('routes/:id')
  getRoute(@Param('id') id: string): Route {
    const route = this.fleet.getRoute(id);
    if (!route) throw new NotFoundException(`route ${id} not found`);
    return route;
  }

  @Get('buses')
  getBuses(): Bus[] {
    return this.fleet.getBuses();
  }
}
