import type { PrismaClient } from '@prisma/client';

import { Bus, Child, Operator, Parent, Route, School } from '../domain/types';
import { FleetRepository } from './fleet.repository';

/** Postgres-backed fleet data via Prisma. Maps DB rows to the domain shapes. */
export class PrismaFleetRepository implements FleetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async loadSchools(): Promise<School[]> {
    const rows = await this.prisma.school.findMany();
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      location: { latitude: s.lat, longitude: s.lng },
      subscriptionStatus: s.subscriptionStatus as School['subscriptionStatus'],
      renewsAt: s.renewsAt,
    }));
  }

  async loadRoutes(): Promise<Route[]> {
    const rows = await this.prisma.route.findMany({
      include: { stops: { orderBy: { order: 'asc' } } },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      schoolId: r.schoolId,
      stops: r.stops.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        location: { latitude: s.lat, longitude: s.lng },
        travelMinutesFromPrev: s.travelMinutesFromPrev,
        scheduledTime: s.scheduledTime,
      })),
    }));
  }

  async loadBuses(): Promise<Bus[]> {
    const rows = await this.prisma.bus.findMany();
    return rows.map((b) => ({
      id: b.id,
      plateNumber: b.plateNumber,
      routeId: b.routeId,
      driverName: b.driverName,
      driverPhone: b.driverPhone,
      capacity: b.capacity,
    }));
  }

  async loadParents(): Promise<Parent[]> {
    const rows = await this.prisma.parent.findMany({
      include: { children: { select: { id: true } } },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      childIds: p.children.map((c) => c.id),
    }));
  }

  async loadOperators(): Promise<Operator[]> {
    const rows = await this.prisma.operator.findMany();
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      phone: o.phone,
      schoolId: o.schoolId,
    }));
  }

  async loadChildren(): Promise<Child[]> {
    const rows = await this.prisma.child.findMany();
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      grade: c.grade,
      parentId: c.parentId,
      schoolId: c.schoolId,
      routeId: c.routeId,
      stopId: c.stopId,
      address: c.address ?? undefined,
      color: c.color,
    }));
  }

  async addChild(child: Child): Promise<void> {
    await this.prisma.child.create({
      data: {
        id: child.id,
        name: child.name,
        grade: child.grade,
        color: child.color,
        address: child.address ?? null,
        parentId: child.parentId,
        schoolId: child.schoolId,
        routeId: child.routeId,
        stopId: child.stopId,
      },
    });
  }

  async updateChild(child: Child): Promise<void> {
    await this.prisma.child.update({
      where: { id: child.id },
      data: {
        name: child.name,
        grade: child.grade,
        color: child.color,
        address: child.address ?? null,
        routeId: child.routeId,
        stopId: child.stopId,
      },
    });
  }

  async removeChild(id: string): Promise<void> {
    await this.prisma.child.delete({ where: { id } });
  }

  async addRoute(route: Route): Promise<void> {
    await this.prisma.route.create({
      data: {
        id: route.id,
        name: route.name,
        schoolId: route.schoolId,
        stops: {
          create: route.stops.map((s) => ({
            id: s.id,
            name: s.name,
            order: s.order,
            lat: s.location.latitude,
            lng: s.location.longitude,
            travelMinutesFromPrev: s.travelMinutesFromPrev,
            scheduledTime: s.scheduledTime,
          })),
        },
      },
    });
  }

  async addBus(bus: Bus): Promise<void> {
    await this.prisma.bus.create({
      data: {
        id: bus.id,
        plateNumber: bus.plateNumber,
        driverName: bus.driverName,
        driverPhone: bus.driverPhone,
        capacity: bus.capacity,
        routeId: bus.routeId,
      },
    });
  }

  async updateBus(bus: Bus): Promise<void> {
    await this.prisma.bus.update({
      where: { id: bus.id },
      data: {
        plateNumber: bus.plateNumber,
        driverName: bus.driverName,
        driverPhone: bus.driverPhone,
        capacity: bus.capacity,
        routeId: bus.routeId,
      },
    });
  }

  async removeBus(id: string): Promise<void> {
    await this.prisma.bus.delete({ where: { id } });
  }

  /** Delete a route with its stops and any bus. Callers must ensure it has no
   * children first (children FK-reference the route). */
  async removeRoute(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.stop.deleteMany({ where: { routeId: id } }),
      this.prisma.bus.deleteMany({ where: { routeId: id } }),
      this.prisma.route.delete({ where: { id } }),
    ]);
  }

  /**
   * Persist a route's stops. Upserts each stop (a child's pin adds/moves one);
   * stops are never deleted here, so a removed child's FK stays valid.
   */
  async updateRoute(route: Route): Promise<void> {
    await this.prisma.$transaction(
      route.stops.map((s) =>
        this.prisma.stop.upsert({
          where: { id: s.id },
          create: {
            id: s.id,
            name: s.name,
            order: s.order,
            lat: s.location.latitude,
            lng: s.location.longitude,
            travelMinutesFromPrev: s.travelMinutesFromPrev,
            scheduledTime: s.scheduledTime,
            routeId: route.id,
          },
          update: {
            name: s.name,
            order: s.order,
            lat: s.location.latitude,
            lng: s.location.longitude,
            travelMinutesFromPrev: s.travelMinutesFromPrev,
            scheduledTime: s.scheduledTime,
          },
        }),
      ),
    );
  }

  async addSchool(school: School): Promise<void> {
    await this.prisma.school.create({
      data: {
        id: school.id,
        name: school.name,
        lat: school.location.latitude,
        lng: school.location.longitude,
        subscriptionStatus: school.subscriptionStatus,
        renewsAt: school.renewsAt,
      },
    });
  }

  async updateSchool(school: School): Promise<void> {
    await this.prisma.school.update({
      where: { id: school.id },
      data: {
        name: school.name,
        lat: school.location.latitude,
        lng: school.location.longitude,
        subscriptionStatus: school.subscriptionStatus,
        renewsAt: school.renewsAt,
      },
    });
  }

  async addOperator(operator: Operator): Promise<void> {
    await this.prisma.operator.create({
      data: {
        id: operator.id,
        name: operator.name,
        phone: operator.phone,
        schoolId: operator.schoolId,
      },
    });
  }

  async addParent(parent: Parent): Promise<void> {
    await this.prisma.parent.create({
      data: {
        id: parent.id,
        name: parent.name,
        email: parent.email,
        phone: parent.phone,
      },
    });
  }
}
