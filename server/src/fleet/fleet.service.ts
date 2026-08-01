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

  /** True when a school's platform access is live, so its families may track. */
  isSchoolEntitled(schoolId: string): boolean {
    const school = this.getSchool(schoolId);
    return school?.subscriptionStatus === 'active' || school?.subscriptionStatus === 'trial';
  }

  /** The school a route belongs to (tenant of everything on that route). */
  getSchoolForRoute(routeId: string): School | undefined {
    const route = this.getRoute(routeId);
    return route ? this.getSchool(route.schoolId) : undefined;
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

  /** All children owned by a school — the tenant-scoped list for its operator. */
  getChildrenForSchool(schoolId: string): Child[] {
    return this.childrenCache.filter((c) => c.schoolId === schoolId);
  }

  getChild(id: string): Child | undefined {
    return this.childrenCache.find((c) => c.id === id);
  }

  getOperators(): Operator[] {
    return this.operatorsCache;
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

  async updateChild(child: Child): Promise<Child> {
    await this.repo.updateChild(child);
    const i = this.childrenCache.findIndex((c) => c.id === child.id);
    if (i >= 0) this.childrenCache[i] = child;
    return child;
  }

  async removeChild(id: string): Promise<void> {
    const child = this.childrenCache.find((c) => c.id === id);
    await this.repo.removeChild(id);
    this.childrenCache = this.childrenCache.filter((c) => c.id !== id);
    if (child) {
      const parent = this.parentsCache.find((p) => p.id === child.parentId);
      if (parent) parent.childIds = parent.childIds.filter((cid) => cid !== id);
    }
  }

  async addRoute(route: Route): Promise<Route> {
    await this.repo.addRoute(route);
    this.routesCache.push(route);
    return route;
  }

  /** Persist a route whose stop list changed (a child pin added/moved a stop). */
  async updateRoute(route: Route): Promise<Route> {
    await this.repo.updateRoute(route);
    const i = this.routesCache.findIndex((r) => r.id === route.id);
    if (i >= 0) this.routesCache[i] = route;
    return route;
  }

  async addSchool(school: School): Promise<School> {
    await this.repo.addSchool(school);
    this.schoolsCache.push(school);
    return school;
  }

  async updateSchool(school: School): Promise<School> {
    await this.repo.updateSchool(school);
    const i = this.schoolsCache.findIndex((s) => s.id === school.id);
    if (i >= 0) this.schoolsCache[i] = school;
    return school;
  }

  async addOperator(operator: Operator): Promise<Operator> {
    await this.repo.addOperator(operator);
    this.operatorsCache.push(operator);
    return operator;
  }

  /** Find a parent by phone, creating a bare record if none exists yet. Used
   * when a school onboards a child under a parent who hasn't signed up. */
  async findOrCreateParentByPhone(phone: string, name?: string): Promise<Parent> {
    const existing = this.getParentByPhone(phone);
    if (existing) return existing;
    const parent: Parent = {
      id: `parent_${normalizePhone(phone).replace(/\D/g, '').slice(-9) || Date.now()}`,
      name: name?.trim() || 'Parent',
      email: '',
      phone: normalizePhone(phone),
      childIds: [],
    };
    await this.repo.addParent(parent);
    this.parentsCache.push(parent);
    return parent;
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
