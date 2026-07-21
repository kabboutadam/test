/**
 * Turns a raw BusPosition into the parent-facing summary: how many stops away
 * the bus is from a given child's stop, an ETA in minutes, and a status label.
 */

import { BusPosition, Route } from '@/models/types';

export type ArrivalPhase =
  | 'approaching' // 1 stop away
  | 'incoming' // 2+ stops away
  | 'arriving' // at the child's stop right now
  | 'picked_up' // bus already passed the child's stop
  | 'not_started';

export interface ArrivalInfo {
  stopsAway: number;
  etaMinutes: number;
  phase: ArrivalPhase;
  label: string;
}

/**
 * @param position   live bus position
 * @param route      the route both the bus and child belong to
 * @param childStopIndex index of the child's stop along the route
 */
export function computeArrival(
  position: BusPosition,
  route: Route,
  childStopIndex: number,
): ArrivalInfo {
  const progressIndex = position.currentStopIndex + position.progressToNext;

  if (position.status === 'not_started') {
    return {
      stopsAway: childStopIndex,
      etaMinutes: sumTravelMinutes(route, 1, childStopIndex),
      phase: 'not_started',
      label: 'Not started yet',
    };
  }

  // How many stops the bus still has to reach before (and including) the child's.
  const stopsAway = Math.ceil(childStopIndex - progressIndex);

  if (stopsAway <= 0) {
    // Bus is at or past the child's stop.
    const atStop = Math.abs(childStopIndex - progressIndex) < 0.15;
    if (atStop || position.currentStopIndex === childStopIndex) {
      return {
        stopsAway: 0,
        etaMinutes: 0,
        phase: 'arriving',
        label: 'Arriving at your stop',
      };
    }
    return {
      stopsAway: 0,
      etaMinutes: 0,
      phase: 'picked_up',
      label: 'Picked up',
    };
  }

  const etaMinutes = estimateEtaMinutes(position, route, childStopIndex);

  if (stopsAway === 1) {
    return {
      stopsAway,
      etaMinutes,
      phase: 'approaching',
      label: '1 stop away',
    };
  }

  return {
    stopsAway,
    etaMinutes,
    phase: 'incoming',
    label: `${stopsAway} stops away`,
  };
}

/**
 * ETA using nominal per-segment travel minutes from the schedule, scaled by how
 * far the bus has progressed into its current segment.
 */
export function estimateEtaMinutes(
  position: BusPosition,
  route: Route,
  childStopIndex: number,
): number {
  const i = position.currentStopIndex;
  if (i >= childStopIndex) return 0;

  // Remaining fraction of the current segment.
  const nextStop = route.stops[i + 1];
  const remainingCurrent =
    nextStop != null
      ? nextStop.travelMinutesFromPrev * (1 - position.progressToNext)
      : 0;

  // Full segments after the current one, up to the child's stop.
  const rest = sumTravelMinutes(route, i + 2, childStopIndex);

  return Math.max(0, Math.round(remainingCurrent + rest));
}

/** Sum travelMinutesFromPrev for stops in [fromIndex, toIndex] inclusive. */
function sumTravelMinutes(route: Route, fromIndex: number, toIndex: number): number {
  let total = 0;
  for (let k = fromIndex; k <= toIndex; k++) {
    const stop = route.stops[k];
    if (stop) total += stop.travelMinutesFromPrev;
  }
  return total;
}
