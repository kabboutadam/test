import { Bus, Child, Parent, Route } from '../domain/types';

/** DI token for the fleet data source (memory or Prisma). */
export const FLEET_REPOSITORY = 'FLEET_REPOSITORY';

/**
 * Loads fleet reference data. FleetService reads everything once at startup and
 * caches it in memory, so hot paths (the positions tick) never hit the DB.
 */
export interface FleetRepository {
  loadRoutes(): Promise<Route[]>;
  loadBuses(): Promise<Bus[]>;
  loadParents(): Promise<Parent[]>;
  loadChildren(): Promise<Child[]>;
}
