/**
 * Seeds Postgres from the same demo data the memory repository uses.
 * Run with: npm run prisma:seed (requires DATABASE_URL and a migrated schema).
 */

import { PrismaClient } from '@prisma/client';

import { buses, children, parents, routes, subscriptions } from '../src/domain/seed';

const prisma = new PrismaClient();

const school = {
  id: 'sch_1',
  name: 'Beirut International College',
  lat: 33.8886,
  lng: 35.4955,
};

async function main(): Promise<void> {
  await prisma.school.upsert({
    where: { id: school.id },
    update: { name: school.name, lat: school.lat, lng: school.lng },
    create: school,
  });

  for (const route of routes) {
    await prisma.route.upsert({
      where: { id: route.id },
      update: { name: route.name, schoolId: route.schoolId },
      create: { id: route.id, name: route.name, schoolId: route.schoolId },
    });
    for (const stop of route.stops) {
      const data = {
        name: stop.name,
        order: stop.order,
        lat: stop.location.latitude,
        lng: stop.location.longitude,
        travelMinutesFromPrev: stop.travelMinutesFromPrev,
        scheduledTime: stop.scheduledTime,
        routeId: route.id,
      };
      await prisma.stop.upsert({
        where: { id: stop.id },
        update: data,
        create: { id: stop.id, ...data },
      });
    }
  }

  for (const bus of buses) {
    const data = {
      plateNumber: bus.plateNumber,
      driverName: bus.driverName,
      driverPhone: bus.driverPhone,
      capacity: bus.capacity,
      routeId: bus.routeId,
    };
    await prisma.bus.upsert({
      where: { id: bus.id },
      update: data,
      create: { id: bus.id, ...data },
    });
  }

  for (const parent of parents) {
    const data = { name: parent.name, email: parent.email, phone: parent.phone };
    await prisma.parent.upsert({
      where: { id: parent.id },
      update: data,
      create: { id: parent.id, ...data },
    });
  }

  for (const child of children) {
    const data = {
      name: child.name,
      grade: child.grade,
      color: child.color,
      parentId: child.parentId,
      routeId: child.routeId,
      stopId: child.stopId,
    };
    await prisma.child.upsert({
      where: { id: child.id },
      update: data,
      create: { id: child.id, ...data },
    });
  }

  for (const sub of subscriptions) {
    await prisma.subscription.upsert({
      where: { parentId: sub.parentId },
      update: { status: sub.status, plan: sub.plan, renewsAt: sub.renewsAt },
      create: {
        parentId: sub.parentId,
        status: sub.status,
        plan: sub.plan,
        renewsAt: sub.renewsAt,
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
