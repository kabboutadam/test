import { LatLng, Route } from './types';

const R = 6371; // km

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in kilometers (Haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Project an equirectangular point to local planar meters-ish coordinates,
 * scaling longitude by cos(latitude) so distances are roughly isotropic at
 * city scale. Good enough to snap GPS onto a route.
 */
function planar(p: LatLng, lat0: number): { x: number; y: number } {
  return {
    x: p.longitude * Math.cos(toRad(lat0)),
    y: p.latitude,
  };
}

export interface RouteProjection {
  /** Index of the stop at the start of the matched segment. */
  currentStopIndex: number;
  /** 0..1 progress along that segment toward the next stop. */
  progressToNext: number;
  /** The snapped point on the route. */
  snapped: LatLng;
  /** Distance from the raw point to the route, in km. */
  offRouteKm: number;
}

/**
 * Snap a raw GPS point onto the route's polyline: find the nearest segment and
 * how far along it the point projects. This is what turns a driver's raw
 * lat/lng into the (currentStopIndex, progressToNext) the whole app understands.
 */
export function projectOntoRoute(point: LatLng, route: Route): RouteProjection {
  const stops = route.stops;
  const lat0 = point.latitude;
  const p = planar(point, lat0);

  let best: RouteProjection | null = null;

  for (let i = 0; i < stops.length - 1; i++) {
    const a = planar(stops[i].location, lat0);
    const b = planar(stops[i + 1].location, lat0);

    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;

    const denom = abx * abx + aby * aby;
    let t = denom === 0 ? 0 : (apx * abx + apy * aby) / denom;
    t = Math.max(0, Math.min(1, t));

    const snapped: LatLng = {
      latitude:
        stops[i].location.latitude +
        (stops[i + 1].location.latitude - stops[i].location.latitude) * t,
      longitude:
        stops[i].location.longitude +
        (stops[i + 1].location.longitude - stops[i].location.longitude) * t,
    };

    const offRouteKm = distanceKm(point, snapped);
    if (!best || offRouteKm < best.offRouteKm) {
      best = {
        currentStopIndex: i,
        progressToNext: t,
        snapped,
        offRouteKm,
      };
    }
  }

  // Degenerate route with a single stop.
  return (
    best ?? {
      currentStopIndex: 0,
      progressToNext: 0,
      snapped: stops[0].location,
      offRouteKm: distanceKm(point, stops[0].location),
    }
  );
}
