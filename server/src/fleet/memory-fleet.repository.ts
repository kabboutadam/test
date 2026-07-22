import { buses, children, parents, routes, schools } from '../domain/seed';
import { Bus, Child, Parent, Route, School } from '../domain/types';
import { FleetRepository } from './fleet.repository';

/** In-memory fleet data from the seed module. The zero-infra default. */
export class MemoryFleetRepository implements FleetRepository {
  // Copy the children array so onboarding writes don't mutate the seed module.
  private readonly childRows: Child[] = [...children];

  async loadSchools(): Promise<School[]> {
    return schools;
  }
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
    return this.childRows;
  }
  async addChild(child: Child): Promise<void> {
    this.childRows.push(child);
  }
}
