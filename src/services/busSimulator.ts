/**
 * Bus movement simulator.
 *
 * Drives one BusPosition per route along its ordered stops and emits updates on
 * a fixed tick. Movement is time-accelerated so buses visibly progress during a
 * demo: each segment takes SEGMENT_SECONDS of wall-clock time, with a short
 * dwell at each stop.
 *
 * This is the ONLY place that fabricates positions. To go live, replace this
 * class with a telemetry source that emits the same BusPosition objects (e.g. a
 * WebSocket subscription to the driver's GPS feed).
 */

import { BusPosition, Route } from '@/models/types';
import { distanceKm, lerpLatLng } from '@/services/geo';

const TICK_MS = 1000;
const SEGMENT_SECONDS = 6; // wall-clock seconds to traverse one segment
const DWELL_SECONDS = 2; // pause at each stop

type Listener = (positions: Record<string, BusPosition>) => void;

interface RouteState {
  route: Route;
  currentStopIndex: number;
  progressToNext: number;
  dwellRemaining: number;
  done: boolean;
}

export class BusSimulator {
  private states: RouteState[];
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(routes: Route[]) {
    this.states = routes.map((route) => ({
      route,
      currentStopIndex: 0,
      progressToNext: 0,
      dwellRemaining: DWELL_SECONDS,
      done: false,
    }));
  }

  start(): void {
    if (this.timer) return;
    this.emit(); // push an initial frame immediately
    this.timer = setInterval(() => {
      this.step();
      this.emit();
    }, TICK_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Restart every bus at the beginning of its route. */
  reset(): void {
    for (const s of this.states) {
      s.currentStopIndex = 0;
      s.progressToNext = 0;
      s.dwellRemaining = DWELL_SECONDS;
      s.done = false;
    }
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot()); // deliver current state to new subscriber
    return () => this.listeners.delete(listener);
  }

  private step(): void {
    const dt = TICK_MS / 1000;
    for (const s of this.states) {
      if (s.done) continue;

      // Dwell at the current stop before departing.
      if (s.dwellRemaining > 0) {
        s.dwellRemaining -= dt;
        continue;
      }

      s.progressToNext += dt / SEGMENT_SECONDS;

      if (s.progressToNext >= 1) {
        s.progressToNext = 0;
        s.currentStopIndex += 1;
        if (s.currentStopIndex >= s.route.stops.length - 1) {
          s.currentStopIndex = s.route.stops.length - 1;
          s.done = true;
        } else {
          s.dwellRemaining = DWELL_SECONDS;
        }
      }
    }
  }

  private snapshot(): Record<string, BusPosition> {
    const out: Record<string, BusPosition> = {};
    for (const s of this.states) {
      out[s.route.id] = this.toPosition(s);
    }
    return out;
  }

  private toPosition(s: RouteState): BusPosition {
    const stops = s.route.stops;
    const i = s.currentStopIndex;
    const from = stops[i];
    const to = stops[Math.min(i + 1, stops.length - 1)];
    const location = lerpLatLng(from.location, to.location, s.progressToNext);

    let status: BusPosition['status'];
    if (s.done) status = 'completed';
    else if (s.dwellRemaining > 0) status = 'at_stop';
    else status = 'en_route';

    const segKm = distanceKm(from.location, to.location);
    const speedKmh =
      status === 'en_route' ? Math.round((segKm / SEGMENT_SECONDS) * 3600) : 0;

    return {
      busId: s.route.id,
      routeId: s.route.id,
      status,
      location,
      currentStopIndex: i,
      progressToNext: s.progressToNext,
      speedKmh,
      updatedAt: Date.now(),
    };
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}
