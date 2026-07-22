import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentOperator, OperatorContext } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FleetService } from '../fleet/fleet.service';
import { PositionsService } from '../positions/positions.service';

/** Operator dashboard API. Everything is scoped to the operator's school. */
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly fleet: FleetService,
    private readonly positions: PositionsService,
  ) {}

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
        plateNumber: bus?.plateNumber ?? null,
        driverName: bus?.driverName ?? null,
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
}
