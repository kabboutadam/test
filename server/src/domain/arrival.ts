import { BusPosition, Route } from './types';

export interface Arrival {
  stopsAway: number;
  /** 'arriving' at the stop, 'incoming' (>=1 away), or 'passed' (already by). */
  phase: 'incoming' | 'arriving' | 'passed';
}

/** Stops-away for a child's stop, from a bus position. Mirrors the app logic. */
export function computeStopsAway(
  position: BusPosition,
  route: Route,
  childStopIndex: number,
): Arrival {
  const progressIndex = position.currentStopIndex + position.progressToNext;
  const stopsAway = Math.ceil(childStopIndex - progressIndex);

  if (stopsAway <= 0) {
    const atStop =
      position.currentStopIndex === childStopIndex ||
      Math.abs(childStopIndex - progressIndex) < 0.15;
    return { stopsAway: 0, phase: atStop ? 'arriving' : 'passed' };
  }
  return { stopsAway, phase: 'incoming' };
}

export function stopIndexOf(route: Route, stopId: string): number {
  return route.stops.findIndex((s) => s.id === stopId);
}
