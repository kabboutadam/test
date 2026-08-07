import { buses, children, operators, parents, routes, schools } from '../domain/seed';
import { Bus, Child, Operator, Parent, Route, School } from '../domain/types';
import { FleetRepository } from './fleet.repository';

/**
 * In-memory fleet data from the seed module. The zero-infra default. Keeps its
 * own copies of the mutable collections so operator/parent writes don't mutate
 * the seed module (and never alias FleetService's cache).
 */
export class MemoryFleetRepository implements FleetRepository {
  private readonly schoolRows: School[] = [...schools];
  private readonly routeRows: Route[] = [...routes];
  private readonly busRows: Bus[] = [...buses];
  private readonly childRows: Child[] = [...children];
  private readonly operatorRows: Operator[] = [...operators];
  private readonly parentRows: Parent[] = parents.map((p) => ({ ...p, childIds: [...p.childIds] }));

  async loadSchools(): Promise<School[]> {
    return this.schoolRows;
  }
  async loadRoutes(): Promise<Route[]> {
    return this.routeRows;
  }
  async loadBuses(): Promise<Bus[]> {
    return this.busRows;
  }
  async loadParents(): Promise<Parent[]> {
    return this.parentRows;
  }
  async loadOperators(): Promise<Operator[]> {
    return this.operatorRows;
  }
  async loadChildren(): Promise<Child[]> {
    return this.childRows;
  }

  async addChild(child: Child): Promise<void> {
    this.childRows.push(child);
  }
  async updateChild(child: Child): Promise<void> {
    const i = this.childRows.findIndex((c) => c.id === child.id);
    if (i >= 0) this.childRows[i] = child;
  }
  async removeChild(id: string): Promise<void> {
    const i = this.childRows.findIndex((c) => c.id === id);
    if (i >= 0) this.childRows.splice(i, 1);
  }
  async addRoute(route: Route): Promise<void> {
    this.routeRows.push(route);
  }
  async updateRoute(route: Route): Promise<void> {
    const i = this.routeRows.findIndex((r) => r.id === route.id);
    if (i >= 0) this.routeRows[i] = route;
  }
  async removeRoute(id: string): Promise<void> {
    const i = this.routeRows.findIndex((r) => r.id === id);
    if (i >= 0) this.routeRows.splice(i, 1);
  }
  async addBus(bus: Bus): Promise<void> {
    this.busRows.push(bus);
  }
  async updateBus(bus: Bus): Promise<void> {
    const i = this.busRows.findIndex((b) => b.id === bus.id);
    if (i >= 0) this.busRows[i] = bus;
  }
  async removeBus(id: string): Promise<void> {
    const i = this.busRows.findIndex((b) => b.id === id);
    if (i >= 0) this.busRows.splice(i, 1);
  }
  async addSchool(school: School): Promise<void> {
    this.schoolRows.push(school);
  }
  async updateSchool(school: School): Promise<void> {
    const i = this.schoolRows.findIndex((s) => s.id === school.id);
    if (i >= 0) this.schoolRows[i] = school;
  }
  async addOperator(operator: Operator): Promise<void> {
    this.operatorRows.push(operator);
  }
  async addParent(parent: Parent): Promise<void> {
    this.parentRows.push(parent);
  }
}
