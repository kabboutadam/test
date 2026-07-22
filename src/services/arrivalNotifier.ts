/**
 * Decides when to fire a local "N stops away" notification, once per threshold
 * per route-run, per child. Mirrors the server's NotificationDecider so the
 * simulator-mode local notifications behave exactly like backend push.
 */

import { ArrivalInfo } from '@/services/stopsAway';

export interface NotificationMessage {
  title: string;
  body: string;
  threshold: number; // positive stop count, or 0 for "arriving"
}

export const DEFAULT_THRESHOLDS = [3, 1, 0];

export class ArrivalNotifier {
  /** childId -> smallest threshold already notified this run (null = none). */
  private notified = new Map<string, number | null>();

  constructor(private readonly thresholds: number[] = DEFAULT_THRESHOLDS) {}

  evaluate(
    childId: string,
    childName: string,
    arrival: ArrivalInfo,
  ): NotificationMessage | null {
    if (arrival.phase === 'not_started') return null;

    if (arrival.phase === 'picked_up') {
      this.notified.set(childId, -1);
      return null;
    }

    const current = arrival.phase === 'arriving' ? 0 : arrival.stopsAway;
    const prev = this.notified.get(childId) ?? null;

    // Further away than last notified → new run; re-arm.
    if (prev !== null && current > prev) this.notified.set(childId, null);

    const already = this.notified.get(childId) ?? null;
    const target = this.thresholds.find(
      (t) => current <= t && (already === null || t < already),
    );
    if (target === undefined) return null;

    this.notified.set(childId, target);
    return { threshold: target, ...message(childName, target) };
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
