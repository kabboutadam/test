/**
 * Seed data for the demo. Coordinates are real Beirut-area neighborhoods so the
 * simulated buses move over a plausible Lebanese map. Swap this module for API
 * calls when the backend is live — nothing else needs to change.
 */

import {
  Bus,
  Child,
  Parent,
  Route,
  RouteSession,
  School,
  Subscription,
} from '@/models/types';

export const school: School = {
  id: 'sch_1',
  name: 'Beirut International College',
  location: { latitude: 33.8886, longitude: 35.4955 },
};

export const schools: School[] = [
  school,
  {
    id: 'sch_2',
    name: 'Mount Lebanon School',
    location: { latitude: 33.9808, longitude: 35.6178 },
  },
];

/**
 * Route A — Achrafieh / Downtown morning pickup, ending at the school.
 * Stops are ordered in pickup sequence.
 */
export const routeA: Route = {
  id: 'route_a',
  name: 'Route A — Achrafieh Morning',
  schoolId: 'sch_1',
  session: 'morning',
  afternoonRouteId: 'route_a_pm',
  stops: [
    {
      id: 'a0',
      name: 'Sassine Square, Achrafieh',
      order: 0,
      location: { latitude: 33.8869, longitude: 35.5197 },
      travelMinutesFromPrev: 0,
      scheduledTime: '06:50',
    },
    {
      id: 'a1',
      name: 'Mar Mikhael',
      order: 1,
      location: { latitude: 33.8959, longitude: 35.5225 },
      travelMinutesFromPrev: 5,
      scheduledTime: '06:55',
    },
    {
      id: 'a2',
      name: 'Gemmayzeh, Rue Gouraud',
      order: 2,
      location: { latitude: 33.8955, longitude: 35.5155 },
      travelMinutesFromPrev: 4,
      scheduledTime: '06:59',
    },
    {
      id: 'a3',
      name: 'Downtown, Martyrs Square',
      order: 3,
      location: { latitude: 33.8959, longitude: 35.5088 },
      travelMinutesFromPrev: 5,
      scheduledTime: '07:04',
    },
    {
      id: 'a4',
      name: 'Bab Idriss',
      order: 4,
      location: { latitude: 33.8975, longitude: 35.5033 },
      travelMinutesFromPrev: 4,
      scheduledTime: '07:08',
    },
    {
      id: 'a5',
      name: 'Wadi Abou Jamil',
      order: 5,
      location: { latitude: 33.8938, longitude: 35.4995 },
      travelMinutesFromPrev: 4,
      scheduledTime: '07:12',
    },
    {
      id: 'a6',
      name: 'Beirut International College (School)',
      order: 6,
      location: { latitude: 33.8886, longitude: 35.4955 },
      travelMinutesFromPrev: 6,
      scheduledTime: '07:18',
    },
  ],
};

/**
 * Route B — Hamra / Verdun morning pickup.
 */
export const routeB: Route = {
  id: 'route_b',
  name: 'Route B — Hamra Morning',
  schoolId: 'sch_1',
  session: 'morning',
  afternoonRouteId: 'route_b_pm',
  stops: [
    {
      id: 'b0',
      name: 'Manara Corniche',
      order: 0,
      location: { latitude: 33.8992, longitude: 35.4757 },
      travelMinutesFromPrev: 0,
      scheduledTime: '06:55',
    },
    {
      id: 'b1',
      name: 'Hamra Street',
      order: 1,
      location: { latitude: 33.8967, longitude: 35.4808 },
      travelMinutesFromPrev: 5,
      scheduledTime: '07:00',
    },
    {
      id: 'b2',
      name: 'Verdun, Dunes Center',
      order: 2,
      location: { latitude: 33.8865, longitude: 35.4823 },
      travelMinutesFromPrev: 6,
      scheduledTime: '07:06',
    },
    {
      id: 'b3',
      name: 'UNESCO',
      order: 3,
      location: { latitude: 33.8797, longitude: 35.4859 },
      travelMinutesFromPrev: 5,
      scheduledTime: '07:11',
    },
    {
      id: 'b4',
      name: 'Mathaf (National Museum)',
      order: 4,
      location: { latitude: 33.8776, longitude: 35.5153 },
      travelMinutesFromPrev: 8,
      scheduledTime: '07:19',
    },
    {
      id: 'b5',
      name: 'Beirut International College (School)',
      order: 5,
      location: { latitude: 33.8886, longitude: 35.4955 },
      travelMinutesFromPrev: 7,
      scheduledTime: '07:26',
    },
  ],
};

/** Route C — Jounieh morning pickup for Mount Lebanon School (sch_2). */
export const routeC: Route = {
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
};

/**
 * Build an afternoon drop-off route from a morning pickup route. The bus and
 * driver are the same; it just runs in reverse — the school (the morning route's
 * last stop) becomes the first stop, and children are dropped at the same
 * neighborhoods they boarded from. Travel times mirror the morning segments;
 * scheduled times are recomputed from `startTime`.
 */
function buildAfternoonRoute(
  morning: Route,
  opts: { id: string; name: string; startTime: string },
): Route {
  const reversed = [...morning.stops].reverse();
  const n = morning.stops.length;
  let clock = parseHm(opts.startTime);

  const stops = reversed.map((stop, idx) => {
    // Travel from the previous reversed stop equals the morning segment time
    // between the same two neighborhoods (segments are symmetric here).
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

  return {
    id: opts.id,
    name: opts.name,
    schoolId: morning.schoolId,
    session: 'afternoon',
    stops,
  };
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

/** Afternoon drop-off routes (school → neighborhoods), one per morning route. */
export const routeApm = buildAfternoonRoute(routeA, {
  id: 'route_a_pm',
  name: 'Route A — Achrafieh Afternoon',
  startTime: '14:15',
});
export const routeBpm = buildAfternoonRoute(routeB, {
  id: 'route_b_pm',
  name: 'Route B — Hamra Afternoon',
  startTime: '14:15',
});
export const routeCpm = buildAfternoonRoute(routeC, {
  id: 'route_c_pm',
  name: 'Route C — Jounieh Afternoon',
  startTime: '14:00',
});

/**
 * The active route set. Seeded with the demo routes so simulator mode works
 * offline; in backend mode AppContext replaces it with the live routes from the
 * server via setRoutes(), so lookups (findRoute/routeForChild) resolve real
 * school routes. It's a live binding, so importers see the replacement.
 */
export let routes: Route[] = [routeA, routeB, routeC, routeApm, routeBpm, routeCpm];

/** Swap in the routes fetched from the backend (called once after login). */
export function setRoutes(next: Route[]): void {
  routes = next;
}

export const buses: Bus[] = [
  {
    id: 'bus_a',
    plateNumber: 'B 123456',
    routeId: 'route_a',
    driverName: 'Elie Karam',
    driverPhone: '+961 3 000 111',
    capacity: 24,
  },
  {
    id: 'bus_b',
    plateNumber: 'B 654321',
    routeId: 'route_b',
    driverName: 'Rami Haddad',
    driverPhone: '+961 3 000 222',
    capacity: 24,
  },
  {
    id: 'bus_c',
    plateNumber: 'B 789012',
    routeId: 'route_c',
    driverName: 'Georges Nassar',
    driverPhone: '+961 3 000 333',
    capacity: 20,
  },
];

export const parent: Parent = {
  id: 'parent_1',
  name: 'Nour Khalil',
  email: 'nour.khalil@example.com',
  phone: '+961 3 555 777',
  childIds: ['child_1', 'child_2'],
};

export const children: Child[] = [
  {
    id: 'child_1',
    name: 'Maya Khalil',
    grade: 'Grade 4',
    parentId: 'parent_1',
    routeId: 'route_a',
    stopId: 'a3', // Downtown, Martyrs Square
    color: '#0B6E4F',
  },
  {
    id: 'child_2',
    name: 'Karim Khalil',
    grade: 'Grade 1',
    parentId: 'parent_1',
    routeId: 'route_b',
    stopId: 'b2', // Verdun
    color: '#C1440E',
  },
];

/** Demo starts in an active free trial so the app is usable on first launch. */
export const initialSubscription: Subscription = {
  status: 'trial',
  plan: null,
  renewsAt: '2026-08-04',
};

// --- lookup helpers ---

export function findRoute(routeId: string): Route | undefined {
  return routes.find((r) => r.id === routeId);
}

export function findBusByRoute(routeId: string): Bus | undefined {
  const direct = buses.find((b) => b.routeId === routeId);
  if (direct) return direct;
  // Afternoon routes have no bus of their own — it's the same bus doing the
  // return trip, so fall back to the morning route's bus.
  const morning = routes.find((r) => r.afternoonRouteId === routeId);
  return morning ? buses.find((b) => b.routeId === morning.id) : undefined;
}

/**
 * Resolve which route + stop applies to a child for the given session. A child
 * is enrolled on a morning route; the afternoon drop-off mirrors it — same bus
 * in reverse, dropping the child at the same neighborhood they boarded from.
 */
export function routeForChild(
  child: Child,
  session: RouteSession,
): { route: Route; stopId: string } {
  const morning = findRoute(child.routeId);
  if (!morning) {
    // Shouldn't happen, but keep the caller safe.
    return { route: routeA, stopId: child.stopId };
  }
  if (session === 'morning' || !morning.afternoonRouteId) {
    return { route: morning, stopId: child.stopId };
  }
  const afternoon = findRoute(morning.afternoonRouteId);
  if (!afternoon) return { route: morning, stopId: child.stopId };

  const boardName = morning.stops.find((s) => s.id === child.stopId)?.name;
  const dropStop =
    afternoon.stops.find((s) => s.name === boardName) ??
    afternoon.stops[afternoon.stops.length - 1];
  return { route: afternoon, stopId: dropStop.id };
}

/** Best-guess default session from the wall clock: morning before 12:00. */
export function currentSession(now: Date = new Date()): RouteSession {
  return now.getHours() < 12 ? 'morning' : 'afternoon';
}

export function findChild(childId: string): Child | undefined {
  return children.find((c) => c.id === childId);
}

export function findStopIndex(route: Route, stopId: string): number {
  return route.stops.findIndex((s) => s.id === stopId);
}
