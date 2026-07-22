import { buses, children, operators, parents, routes, schools } from '../domain/seed';
import { Bus, Child, Operator, Parent, Route, School } from '../domain/types';
import { FleetRepository } from './fleet.repository';

/**
 * In-memory fleet data from the seed module. The zero-infra default. Keeps its
 * own copies of the mutable collections so operator/parent writes don't mutate
 * the seed module (and never alias FleetService's cache).
 */
export class MemoryFleetRepository implements FleetRepository {
  private readonly routeRows: Route[] = [...routes];
  private readonly busRows: Bus[] = [...buses];
  private readonly childRows: Child[] = [...children];

  async loadSchools(): Promise<School[]> {
    return schools;
  }
  async loadRoutes(): Promise<Route[]> {
    return this.routeRows;
  }
  async loadBuses(): Promise<Bus[]> {
    return this.busRows;
  }
  async loadParents(): Promise<Parent[]> {
    return parents;
  }
  async loadOperators(): Promise<Operator[]> {
    return operators;
  }
  async loadChildren(): Promise<Child[]> {
    return this.childRows;
  }

  async addChild(child: Child): Promise<void> {
    this.childRows.push(child);
  }
  async addRoute(route: Route): Promise<void> {
    this.routeRows.push(route);
  }
  async addBus(bus: Bus): Promise<void> {
    this.busRows.push(bus);
  }
  async updateBus(bus: Bus): Promise<void> {
    const i = this.busRows.findIndex((b) => b.id === bus.id);
    if (i >= 0) this.busRows[i] = bus;
  }
}
