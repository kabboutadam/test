/**
 * Core domain model for BusMapp.
 *
 * These types are intentionally transport-agnostic: today bus positions come
 * from the built-in simulator, but the same shapes will hold real GPS data
 * (driver phone or hardware tracker) later with no changes to the UI layer.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface School {
  id: string;
  name: string;
  location: LatLng;
}

export interface Stop {
  id: string;
  name: string;
  /** Zero-based position of this stop along its route. */
  order: number;
  location: LatLng;
  /** Nominal minutes of travel from the previous stop (0 for the first stop). */
  travelMinutesFromPrev: number;
  /** Human-readable scheduled arrival, e.g. "07:15". */
  scheduledTime: string;
}

export interface Route {
  id: string;
  name: string;
  schoolId: string;
  /** Ordered list of stops; index === Stop.order. */
  stops: Stop[];
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
  routeId: string;
  /** The stop where this child boards / is dropped off. */
  stopId: string;
  /** Accent color used for the child's avatar in the UI. */
  color: string;
}

export interface Parent {
  id: string;
  name: string;
  email: string;
  phone: string;
  childIds: string[];
}

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'none';

export interface Subscription {
  status: SubscriptionStatus;
  plan: 'monthly' | 'yearly' | null;
  /** ISO date the current period renews or expires. */
  renewsAt: string | null;
}

export type BusStatus =
  | 'not_started'
  | 'en_route'
  | 'at_stop'
  | 'completed';

/**
 * A live snapshot of where a bus is. This is the single object the tracking
 * UI consumes, whether it was produced by the simulator or real telemetry.
 */
export interface BusPosition {
  busId: string;
  routeId: string;
  status: BusStatus;
  location: LatLng;
  /** Index of the last stop the bus reached/departed. */
  currentStopIndex: number;
  /** 0..1 progress from currentStopIndex toward the next stop. */
  progressToNext: number;
  speedKmh: number;
  updatedAt: number;
}
