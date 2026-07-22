import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';

import { Bus, Child, Route } from '../domain/types';
import { FleetService } from './fleet.service';

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

  /**
   * Children for a parent. `parentId` is a query param for the demo; wire this
   * to the authenticated user once auth lands.
   */
  @Get('children')
  getChildren(@Query('parentId') parentId: string): Child[] {
    return this.fleet.getChildrenForParent(parentId ?? 'parent_1');
  }
}
