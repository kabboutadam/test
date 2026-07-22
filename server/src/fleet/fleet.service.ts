import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { normalizePhone } from '../domain/phone';
import { Bus, Child, Operator, Parent, Route, School } from '../domain/types';
import { FLEET_REPOSITORY, FleetRepository } from './fleet.repository';

/**
 * Read model over the fleet data. Loads everything from the repository once at
 * startup and serves it from memory, so callers (including the positions tick)
 * stay synchronous and never wait on the DB.
 */
@Injectable()
export class FleetService implements OnModuleInit {
  private schoolsCache: School[] = [];
  private routesCache: Route[] = [];
  private busesCache: Bus[] = [];
  private parentsCache: Parent[] = [];
  private operatorsCache: Operator[] = [];
  private childrenCache: Child[] = [];

  constructor(
    @Inject(FLEET_REPOSITORY) private readonly repo: FleetRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const [schools, routes, buses, parents, operators, children] = await Promise.all([
      this.repo.loadSchools(),
      this.repo.loadRoutes(),
      this.repo.loadBuses(),
      this.repo.loadParents(),
      this.repo.loadOperators(),
      this.repo.loadChildren(),
    ]);
    this.schoolsCache = schools;
    this.operatorsCache = operators;
    // Copy the mutable collections so writes update only our cache, never a
    // repository's internal array (the memory repo returns its store by ref).
    this.routesCache = [...routes];
    this.busesCache = [...buses];
    this.parentsCache = parents.map((p) => ({ ...p, childIds: [...p.childIds] }));
    this.childrenCache = [...children];
  }

  getSchool(id: string): School | undefined {
    return this.schoolsCache.find((s) => s.id === id);
  }

  getOperatorByPhone(phone: string): Operator | undefined {
    const target = normalizePhone(phone);
    return this.operatorsCache.find((o) => normalizePhone(o.phone) === target);
  }

  getSchools(): School[] {
    return this.schoolsCache;
  }

  getRoutesForSchool(schoolId: string): Route[] {
    return this.routesCache.filter((r) => r.schoolId === schoolId);
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

  /** Onboard a child: persist it and update the in-memory cache. */
  async addChild(child: Child): Promise<Child> {
    await this.repo.addChild(child);
    this.childrenCache.push(child);
    const parent = this.parentsCache.find((p) => p.id === child.parentId);
    if (parent && !parent.childIds.includes(child.id)) {
      parent.childIds.push(child.id);
    }
    return child;
  }

  async addRoute(route: Route): Promise<Route> {
    await this.repo.addRoute(route);
    this.routesCache.push(route);
    return route;
  }

  async addBus(bus: Bus): Promise<Bus> {
    await this.repo.addBus(bus);
    this.busesCache.push(bus);
    return bus;
  }

  async updateBus(bus: Bus): Promise<Bus> {
    await this.repo.updateBus(bus);
    const i = this.busesCache.findIndex((b) => b.id === bus.id);
    if (i >= 0) this.busesCache[i] = bus;
    return bus;
  }
}
