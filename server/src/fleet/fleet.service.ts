import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { normalizePhone } from '../domain/phone';
import { Bus, Child, Parent, Route } from '../domain/types';
import { FLEET_REPOSITORY, FleetRepository } from './fleet.repository';

/**
 * Read model over the fleet data. Loads everything from the repository once at
 * startup and serves it from memory, so callers (including the positions tick)
 * stay synchronous and never wait on the DB.
 */
@Injectable()
export class FleetService implements OnModuleInit {
  private routesCache: Route[] = [];
  private busesCache: Bus[] = [];
  private parentsCache: Parent[] = [];
  private childrenCache: Child[] = [];

  constructor(
    @Inject(FLEET_REPOSITORY) private readonly repo: FleetRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const [routes, buses, parents, children] = await Promise.all([
      this.repo.loadRoutes(),
      this.repo.loadBuses(),
      this.repo.loadParents(),
      this.repo.loadChildren(),
    ]);
    this.routesCache = routes;
    this.busesCache = buses;
    this.parentsCache = parents;
    this.childrenCache = children;
  }

  getRoutes(): Route[] {
    return this.routesCache;
  }

  getRoute(id: string): Route | undefined {
    return this.routesCache.find((r) => r.id === id);
  }

  getBuses(): Bus[] {
    return this.busesCache;
  }

  getBusByRoute(routeId: string): Bus | undefined {
    return this.busesCache.find((b) => b.routeId === routeId);
  }

  getBusByDriverPhone(phone: string): Bus | undefined {
    const target = normalizePhone(phone);
    return this.busesCache.find((b) => normalizePhone(b.driverPhone) === target);
  }

  getParent(id: string): Parent | undefined {
    return this.parentsCache.find((p) => p.id === id);
  }

  getParentByPhone(phone: string): Parent | undefined {
    const target = normalizePhone(phone);
    return this.parentsCache.find((p) => normalizePhone(p.phone) === target);
  }

  getChildrenForParent(parentId: string): Child[] {
    return this.childrenCache.filter((c) => c.parentId === parentId);
  }

  getChildrenForRoute(routeId: string): Child[] {
    return this.childrenCache.filter((c) => c.routeId === routeId);
  }

  getChild(id: string): Child | undefined {
    return this.childrenCache.find((c) => c.id === id);
  }
}
