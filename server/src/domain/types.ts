/**
 * Backend domain model. Mirrors the mobile app's `src/models/types.ts` so the
 * same BusPosition flows over the wire unchanged. (Kept as a separate copy to
 * avoid cross-package path coupling; extract into a shared package when the two
 * are versioned together.)
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface School {
  id: string;
  name: string;
  location: LatLng;
  /** Platform access is sold per school: when active/trial, its families can
   * track; when expired/none, tracking is locked for all of them. */
  subscriptionStatus: SubscriptionStatus;
  renewsAt: string | null;
}

export interface Stop {
  id: string;
  name: string;
  order: number;
  location: LatLng;
  travelMinutesFromPrev: number;
  scheduledTime: string;
}

export type RouteSession = 'morning' | 'afternoon';

export interface Route {
  id: string;
  name: string;
  schoolId: string;
  stops: Stop[];
  /** Morning pickup or afternoon drop-off. Defaults to morning when absent. */
  session?: RouteSession;
  /** On a morning route, the id of its afternoon counterpart. */
  afternoonRouteId?: string;
}

export interface Bus {
  id: string;
  plateNumber: string;
  routeId: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
}

export interface Child {
  id: string;
  name: string;
  grade: string;
  parentId: string;
  /** The school that owns this child's record — the tenant boundary. Every
   * read/write is scoped by this so no school can see another's kids. */
  schoolId: string;
  routeId: string;
  /** The child's pickup stop on the route (created from their home pin). */
  stopId: string;
  /** Human-readable home address label shown next to the pin. */
  address?: string;
  color: string;
}

export interface Parent {
  id: string;
  name: string;
  email: string;
  phone: string;
  childIds: string[];
}

/** A school operator/admin who manages and monitors one school's fleet. */
export interface Operator {
  id: string;
  name: string;
  phone: string;
  schoolId: string;
}

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'none';

export interface Subscription {
  parentId: string;
  status: SubscriptionStatus;
  plan: 'monthly' | 'yearly' | null;
  renewsAt: string | null;
}

export type BusStatus = 'not_started' | 'en_route' | 'at_stop' | 'completed';

/** Where a bus position came from — a real driver stream or the simulator. */
export type PositionSourceKind = 'driver' | 'simulator';

export interface BusPosition {
  busId: string;
  routeId: string;
  status: BusStatus;
  location: LatLng;
  currentStopIndex: number;
  progressToNext: number;
  speedKmh: number;
  updatedAt: number;
  source: PositionSourceKind;
}
