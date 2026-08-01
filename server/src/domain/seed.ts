/**
 * Seed data. Identical to the mobile demo so both sides agree on ids. Replace
 * this module with a Postgres-backed repository (Prisma/TypeORM) later — the
 * services depend only on the shapes, not on where they come from.
 */

import { Bus, Child, Operator, Parent, Route, School, Subscription } from './types';

export const schools: School[] = [
  { id: 'sch_1', name: 'Beirut International College', location: { latitude: 33.8886, longitude: 35.4955 }, subscriptionStatus: 'active', renewsAt: '2027-01-01' },
  { id: 'sch_2', name: 'Mount Lebanon School', location: { latitude: 33.9808, longitude: 35.6178 }, subscriptionStatus: 'trial', renewsAt: '2026-09-01' },
];

const morningRoutes: Route[] = [
  {
    id: 'route_a',
    name: 'Route A — Achrafieh Morning',
    schoolId: 'sch_1',
    session: 'morning',
    afternoonRouteId: 'route_a_pm',
    stops: [
      { id: 'a0', name: 'Sassine Square, Achrafieh', order: 0, location: { latitude: 33.8869, longitude: 35.5197 }, travelMinutesFromPrev: 0, scheduledTime: '06:50' },
      { id: 'a1', name: 'Mar Mikhael', order: 1, location: { latitude: 33.8959, longitude: 35.5225 }, travelMinutesFromPrev: 5, scheduledTime: '06:55' },
      { id: 'a2', name: 'Gemmayzeh, Rue Gouraud', order: 2, location: { latitude: 33.8955, longitude: 35.5155 }, travelMinutesFromPrev: 4, scheduledTime: '06:59' },
      { id: 'a3', name: 'Downtown, Martyrs Square', order: 3, location: { latitude: 33.8959, longitude: 35.5088 }, travelMinutesFromPrev: 5, scheduledTime: '07:04' },
      { id: 'a4', name: 'Bab Idriss', order: 4, location: { latitude: 33.8975, longitude: 35.5033 }, travelMinutesFromPrev: 4, scheduledTime: '07:08' },
      { id: 'a5', name: 'Wadi Abou Jamil', order: 5, location: { latitude: 33.8938, longitude: 35.4995 }, travelMinutesFromPrev: 4, scheduledTime: '07:12' },
      { id: 'a6', name: 'Beirut International College (School)', order: 6, location: { latitude: 33.8886, longitude: 35.4955 }, travelMinutesFromPrev: 6, scheduledTime: '07:18' },
    ],
  },
  {
    id: 'route_b',
    name: 'Route B — Hamra Morning',
    schoolId: 'sch_1',
    session: 'morning',
    afternoonRouteId: 'route_b_pm',
    stops: [
      { id: 'b0', name: 'Manara Corniche', order: 0, location: { latitude: 33.8992, longitude: 35.4757 }, travelMinutesFromPrev: 0, scheduledTime: '06:55' },
      { id: 'b1', name: 'Hamra Street', order: 1, location: { latitude: 33.8967, longitude: 35.4808 }, travelMinutesFromPrev: 5, scheduledTime: '07:00' },
      { id: 'b2', name: 'Verdun, Dunes Center', order: 2, location: { latitude: 33.8865, longitude: 35.4823 }, travelMinutesFromPrev: 6, scheduledTime: '07:06' },
      { id: 'b3', name: 'UNESCO', order: 3, location: { latitude: 33.8797, longitude: 35.4859 }, travelMinutesFromPrev: 5, scheduledTime: '07:11' },
      { id: 'b4', name: 'Mathaf (National Museum)', order: 4, location: { latitude: 33.8776, longitude: 35.5153 }, travelMinutesFromPrev: 8, scheduledTime: '07:19' },
      { id: 'b5', name: 'Beirut International College (School)', order: 5, location: { latitude: 33.8886, longitude: 35.4955 }, travelMinutesFromPrev: 7, scheduledTime: '07:26' },
    ],
  },
  {
    id: 'route_c',
    name: 'Route C — Jounieh Morning',
    schoolId: 'sch_2',
    session: 'morning',
    afternoonRouteId: 'route_c_pm',
    stops: [
      { id: 'c0', name: 'Jounieh, Old Souk', order: 0, location: { latitude: 33.9808, longitude: 35.6178 }, travelMinutesFromPrev: 0, scheduledTime: '06:45' },
      { id: 'c1', name: 'Kaslik', order: 1, location: { latitude: 33.9736, longitude: 35.6144 }, travelMinutesFromPrev: 5, scheduledTime: '06:50' },
      { id: 'c2', name: 'Zouk Mikael', order: 2, location: { latitude: 33.9631, longitude: 35.6089 }, travelMinutesFromPrev: 6, scheduledTime: '06:56' },
      { id: 'c3', name: 'Adonis', order: 3, location: { latitude: 33.9556, longitude: 35.6208 }, travelMinutesFromPrev: 5, scheduledTime: '07:01' },
      { id: 'c4', name: 'Mount Lebanon School', order: 4, location: { latitude: 33.9808, longitude: 35.6178 }, travelMinutesFromPrev: 8, scheduledTime: '07:09' },
    ],
  },
];

/**
 * Build an afternoon drop-off route from a morning pickup route: same bus and
 * driver, reversed — the school becomes the first stop and children are dropped
 * at the same neighborhoods they boarded from. Kept identical to the mobile
 * app's generator (src/data/mockData.ts) so both sides agree on ids, ordering,
 * and stop counts (positions travel by index).
 */
function buildAfternoonRoute(
  morning: Route,
  opts: { id: string; name: string; startTime: string },
): Route {
  const reversed = [...morning.stops].reverse();
  const n = morning.stops.length;
  let clock = parseHm(opts.startTime);

  const stops = reversed.map((stop, idx) => {
    const travel = idx === 0 ? 0 : morning.stops[n - idx].travelMinutesFromPrev;
    clock += travel;
    return {
      id: `${opts.id}_${idx}`,
      name: stop.name,
      order: idx,
      location: stop.location,
      travelMinutesFromPrev: travel,
      scheduledTime: formatHm(clock),
    };
  });

  return { id: opts.id, name: opts.name, schoolId: morning.schoolId, session: 'afternoon', stops };
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

function formatHm(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const afternoonRoutes: Route[] = [
  buildAfternoonRoute(morningRoutes[0], { id: 'route_a_pm', name: 'Route A — Achrafieh Afternoon', startTime: '14:15' }),
  buildAfternoonRoute(morningRoutes[1], { id: 'route_b_pm', name: 'Route B — Hamra Afternoon', startTime: '14:15' }),
  buildAfternoonRoute(morningRoutes[2], { id: 'route_c_pm', name: 'Route C — Jounieh Afternoon', startTime: '14:00' }),
];

export const routes: Route[] = [...morningRoutes, ...afternoonRoutes];

export const buses: Bus[] = [
  { id: 'bus_a', plateNumber: 'B 123456', routeId: 'route_a', driverName: 'Elie Karam', driverPhone: '+961 3 000 111', capacity: 24 },
  { id: 'bus_b', plateNumber: 'B 654321', routeId: 'route_b', driverName: 'Rami Haddad', driverPhone: '+961 3 000 222', capacity: 24 },
  { id: 'bus_c', plateNumber: 'B 789012', routeId: 'route_c', driverName: 'Georges Nassar', driverPhone: '+961 3 000 333', capacity: 20 },
];

export const parents: Parent[] = [
  { id: 'parent_1', name: 'Nour Khalil', email: 'nour.khalil@example.com', phone: '+961 3 555 777', childIds: ['child_1', 'child_2'] },
];

export const operators: Operator[] = [
  { id: 'op_1', name: 'BIC Operations', phone: '+961 3 999 000', schoolId: 'sch_1' },
  { id: 'op_2', name: 'Mount Lebanon Operations', phone: '+961 3 999 111', schoolId: 'sch_2' },
];

export const children: Child[] = [
  { id: 'child_1', name: 'Maya Khalil', grade: 'Grade 4', parentId: 'parent_1', schoolId: 'sch_1', routeId: 'route_a', stopId: 'a3', address: 'Downtown, Martyrs Square', color: '#0B6E4F' },
  { id: 'child_2', name: 'Karim Khalil', grade: 'Grade 1', parentId: 'parent_1', schoolId: 'sch_1', routeId: 'route_b', stopId: 'b2', address: 'Verdun, Dunes Center', color: '#C1440E' },
];

export const subscriptions: Subscription[] = [
  { parentId: 'parent_1', status: 'trial', plan: null, renewsAt: '2026-08-04' },
];
