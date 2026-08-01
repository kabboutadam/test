import { Bus, Child, Operator, Parent, Route, School } from '../domain/types';

/** DI token for the fleet data source (memory or Prisma). */
export const FLEET_REPOSITORY = 'FLEET_REPOSITORY';

/**
 * Loads fleet reference data. FleetService reads everything once at startup and
 * caches it in memory, so hot paths (the positions tick) never hit the DB.
 * Writes (onboarding a child) go straight to the store and update the cache.
 */
export interface FleetRepository {
  loadSchools(): Promise<School[]>;
  loadRoutes(): Promise<Route[]>;
  loadBuses(): Promise<Bus[]>;
  loadParents(): Promise<Parent[]>;
  loadOperators(): Promise<Operator[]>;
  loadChildren(): Promise<Child[]>;
  addChild(child: Child): Promise<void>;
  updateChild(child: Child): Promise<void>;
  removeChild(id: string): Promise<void>;
  addRoute(route: Route): Promise<void>;
  /** Persist a route's stop list (used when a child's pin adds/removes a stop). */
  updateRoute(route: Route): Promise<void>;
  addBus(bus: Bus): Promise<void>;
  updateBus(bus: Bus): Promise<void>;
  // Platform / tenant management.
  addSchool(school: School): Promise<void>;
  updateSchool(school: School): Promise<void>;
  addOperator(operator: Operator): Promise<void>;
  addParent(parent: Parent): Promise<void>;
}
