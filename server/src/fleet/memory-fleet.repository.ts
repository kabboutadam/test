import { buses, children, parents, routes } from '../domain/seed';
import { Bus, Child, Parent, Route } from '../domain/types';
import { FleetRepository } from './fleet.repository';

/** In-memory fleet data from the seed module. The zero-infra default. */
export class MemoryFleetRepository implements FleetRepository {
  async loadRoutes(): Promise<Route[]> {
    return routes;
  }
  async loadBuses(): Promise<Bus[]> {
    return buses;
  }
  async loadParents(): Promise<Parent[]> {
    return parents;
  }
  async loadChildren(): Promise<Child[]> {
    return children;
  }
}
