import { Controller, Get, Param } from '@nestjs/common';

import { Route, School } from '../domain/types';
import { FleetService } from './fleet.service';

/** Public catalog for onboarding: schools and their routes. */
@Controller('schools')
export class SchoolsController {
  constructor(private readonly fleet: FleetService) {}

  @Get()
  getSchools(): School[] {
    return this.fleet.getSchools();
  }

  @Get(':id/routes')
  getRoutes(@Param('id') id: string): Route[] {
    return this.fleet.getRoutesForSchool(id);
  }
}
