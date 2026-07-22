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
      routeId: c.routeId,
      stopId: c.stopId,
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
        parentId: child.parentId,
        routeId: child.routeId,
        stopId: child.stopId,
      },
    });
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
}
