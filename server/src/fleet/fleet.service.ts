import { Injectable } from '@nestjs/common';

import { buses, children, parents, routes } from '../domain/seed';
import { Bus, Child, Parent, Route } from '../domain/types';

/**
 * Read model over the fleet data. In-memory today; swap the arrays for a
 * database repository without changing callers.
 */
@Injectable()
export class FleetService {
  getRoutes(): Route[] {
    return routes;
  }

  getRoute(id: string): Route | undefined {
    return routes.find((r) => r.id === id);
  }

  getBuses(): Bus[] {
    return buses;
  }

  getBusByRoute(routeId: string): Bus | undefined {
    return buses.find((b) => b.routeId === routeId);
  }

  getParent(id: string): Parent | undefined {
    return parents.find((p) => p.id === id);
  }

  /** Children belonging to a parent (the parent-app home list). */
  getChildrenForParent(parentId: string): Child[] {
    return children.filter((c) => c.parentId === parentId);
  }

  getChild(id: string): Child | undefined {
    return children.find((c) => c.id === id);
  }
}
