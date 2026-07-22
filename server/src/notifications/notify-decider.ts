import { Arrival } from '../domain/arrival';

export interface NotificationMessage {
  title: string;
  body: string;
  /** The threshold that fired: a positive stop count, or 0 for "arriving". */
  threshold: number;
}

/** Stop counts (and 0 = arriving) at which a parent is notified, high → low. */
export const DEFAULT_THRESHOLDS = [3, 1, 0];

/**
 * Decides when to notify, once per threshold per route-run, per child.
 *
 * It fires when the bus crosses *down* to a threshold not yet sent this run
 * (e.g. 3 stops, then 1, then arriving). State resets when the bus moves further
 * away again — i.e. a new run after the route restarts — so the next run
 * notifies afresh. Pure and deterministic given the call sequence, so it's
 * unit-testable without any sockets.
 */
export class NotificationDecider {
  /** childId -> smallest threshold already notified this run (null = none). */
  private notified = new Map<string, number | null>();

  constructor(private readonly thresholds: number[] = DEFAULT_THRESHOLDS) {}

  evaluate(
    childId: string,
    childName: string,
    arrival: Arrival,
  ): NotificationMessage | null {
    const prev = this.notified.get(childId) ?? null;

    if (arrival.phase === 'passed') {
      this.notified.set(childId, -1); // done for this run
      return null;
    }

    const current = arrival.phase === 'arriving' ? 0 : arrival.stopsAway;

    // Bus is further away than the last thing we notified (a new run after the
    // route restarted, incl. coming back from 'passed'/-1) → re-arm.
    if (prev !== null && current > prev) {
      this.notified.set(childId, null);
    }

    const already = this.notified.get(childId) ?? null;
    const target = this.thresholds.find(
      (t) => current <= t && (already === null || t < already),
    );
    if (target === undefined) return null;

    this.notified.set(childId, target);
    return {
      threshold: target,
      ...message(childName, target),
    };
  }

  /** Forget a child's state (e.g. when a route completes). */
  reset(childId: string): void {
    this.notified.delete(childId);
  }
}

function message(name: string, threshold: number): { title: string; body: string } {
  if (threshold === 0) {
    return {
      title: `🚌 ${name}'s bus is arriving`,
      body: `The bus is reaching ${name}'s stop now.`,
    };
  }
  return {
    title: `🚌 ${name}'s bus is ${threshold} stop${threshold === 1 ? '' : 's'} away`,
    body: `Time to head to ${name}'s stop.`,
  };
}
