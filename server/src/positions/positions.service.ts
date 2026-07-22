import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { distanceKm, projectOntoRoute } from '../domain/geo';
import { BusPosition, LatLng, Route } from '../domain/types';
import { FleetService } from '../fleet/fleet.service';

const TICK_MS = 1000;
const SEGMENT_SECONDS = 6; // simulator: wall-clock seconds per segment
const DWELL_SECONDS = 2;
const DRIVER_TIMEOUT_MS = 10_000; // fall back to sim if no GPS for this long
const OFF_ROUTE_KM = 1.5; // ignore GPS this far from the route

type Listener = (position: BusPosition) => void;

interface SimState {
  currentStopIndex: number;
  progressToNext: number;
  dwellRemaining: number;
  done: boolean;
  lastDriverAt: number; // 0 = never; drives the sim-vs-driver decision
}

/**
 * Owns the live BusPosition for every route.
 *
 * Priority: a live driver GPS stream wins; if a route has no driver (or the
 * driver's stream goes stale), the simulator advances it so the demo always has
 * moving buses. Either way the emitted BusPosition is identical in shape.
 */
@Injectable()
export class PositionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PositionsService.name);
  private readonly positions = new Map<string, BusPosition>();
  private readonly sim = new Map<string, SimState>();
  private readonly listeners = new Set<Listener>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly fleet: FleetService) {}

  onModuleInit(): void {
    for (const route of this.fleet.getRoutes()) this.registerRoute(route.id);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.logger.log(`Tracking ${this.positions.size} routes`);
  }

  /** Begin tracking a route (e.g. one an operator just created). Idempotent. */
  registerRoute(routeId: string): void {
    if (this.sim.has(routeId)) return;
    const route = this.fleet.getRoute(routeId);
    if (!route) return;
    this.sim.set(routeId, {
      currentStopIndex: 0,
      progressToNext: 0,
      dwellRemaining: DWELL_SECONDS,
      done: false,
      lastDriverAt: 0,
    });
    this.positions.set(routeId, this.simPosition(route));
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  onUpdate(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): BusPosition[] {
    return [...this.positions.values()];
  }

  getForRoute(routeId: string): BusPosition | undefined {
    return this.positions.get(routeId);
  }

  /**
   * Ingest a raw GPS reading from a driver. Snaps it onto the route and turns it
   * into a BusPosition. Readings too far off the route are rejected.
   */
  ingestGps(routeId: string, location: LatLng, reportedSpeedKmh?: number): BusPosition | null {
    const route = this.fleet.getRoute(routeId);
    if (!route) return null;

    const proj = projectOntoRoute(location, route);
    if (proj.offRouteKm > OFF_ROUTE_KM) {
      this.logger.warn(
        `Rejected GPS for ${routeId}: ${proj.offRouteKm.toFixed(2)}km off route`,
      );
      return null;
    }

    const state = this.sim.get(routeId)!;
    const prev = this.positions.get(routeId);
    const now = Date.now();

    // Keep sim state aligned with the driver so a handover back to sim is smooth.
    state.currentStopIndex = proj.currentStopIndex;
    state.progressToNext = proj.progressToNext;
    state.done = this.isDone(route, proj.currentStopIndex, proj.progressToNext);
    state.lastDriverAt = now;

    const speedKmh = reportedSpeedKmh ?? this.estimateSpeed(prev, proj.snapped, now);
    const position: BusPosition = {
      busId: this.fleet.getBusByRoute(routeId)?.id ?? routeId,
      routeId,
      status: state.done
        ? 'completed'
        : speedKmh < 3
          ? 'at_stop'
          : 'en_route',
      location: proj.snapped,
      currentStopIndex: proj.currentStopIndex,
      progressToNext: proj.progressToNext,
      speedKmh: Math.round(speedKmh),
      updatedAt: now,
      source: 'driver',
    };

    this.positions.set(routeId, position);
    this.emit(position);
    return position;
  }

  private tick(): void {
    const now = Date.now();
    for (const route of this.fleet.getRoutes()) {
      const state = this.sim.get(route.id)!;
      const driverActive = now - state.lastDriverAt < DRIVER_TIMEOUT_MS;
      if (driverActive) continue; // driver owns this route right now

      this.advanceSim(route, state);
      const position = this.simPosition(route);
      this.positions.set(route.id, position);
      this.emit(position);
    }
  }

  private advanceSim(route: Route, s: SimState): void {
    if (s.done) return;
    const dt = TICK_MS / 1000;

    if (s.dwellRemaining > 0) {
      s.dwellRemaining -= dt;
      return;
    }
    s.progressToNext += dt / SEGMENT_SECONDS;
    if (s.progressToNext >= 1) {
      s.progressToNext = 0;
      s.currentStopIndex += 1;
      if (s.currentStopIndex >= route.stops.length - 1) {
        s.currentStopIndex = route.stops.length - 1;
        s.done = true;
      } else {
        s.dwellRemaining = DWELL_SECONDS;
      }
    }
  }

  private simPosition(route: Route): BusPosition {
    const s = this.sim.get(route.id)!;
    const stops = route.stops;
    const i = s.currentStopIndex;
    const from = stops[i];
    const to = stops[Math.min(i + 1, stops.length - 1)];
    const location: LatLng = {
      latitude: from.location.latitude + (to.location.latitude - from.location.latitude) * s.progressToNext,
      longitude: from.location.longitude + (to.location.longitude - from.location.longitude) * s.progressToNext,
    };

    const status = s.done ? 'completed' : s.dwellRemaining > 0 ? 'at_stop' : 'en_route';
    // Realistic speed from the schedule (distance / nominal minutes), not the
    // time-accelerated sim clock — otherwise the demo shows absurd km/h.
    const segKm = distanceKm(from.location, to.location);
    const nominalMin = to.travelMinutesFromPrev || 5;
    const speedKmh = status === 'en_route' ? Math.round(segKm / (nominalMin / 60)) : 0;

    return {
      busId: this.fleet.getBusByRoute(route.id)?.id ?? route.id,
      routeId: route.id,
      status,
      location,
      currentStopIndex: i,
      progressToNext: s.progressToNext,
      speedKmh,
      updatedAt: Date.now(),
      source: 'simulator',
    };
  }

  private isDone(route: Route, stopIndex: number, progress: number): boolean {
    return stopIndex >= route.stops.length - 1 && progress >= 0.99;
  }

  private estimateSpeed(prev: BusPosition | undefined, next: LatLng, now: number): number {
    if (!prev) return 0;
    const dtHours = (now - prev.updatedAt) / 3_600_000;
    if (dtHours <= 0) return prev.speedKmh;
    return distanceKm(prev.location, next) / dtHours;
  }

  private emit(position: BusPosition): void {
    for (const l of this.listeners) l(position);
  }
}
