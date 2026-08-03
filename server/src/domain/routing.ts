/**
 * Real road driving times via OSRM (Open Source Routing Machine).
 *
 * Keyless and free, matching the app's other services (Nominatim geocoding).
 * The public demo server is fine for low volume; point `OSRM_URL` at your own
 * OSRM instance for production. Any failure (offline, rate-limited, disabled)
 * returns null so callers fall back to a straight-line distance estimate.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const OSRM_URL = process.env.OSRM_URL ?? 'https://router.project-osrm.org';
const TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS ?? 4000);

/**
 * Driving minutes for each leg between consecutive points. For N points it
 * returns N-1 leg durations (index i = travel from point i to point i+1), each
 * at least 1 minute. Returns null when routing is disabled or unavailable.
 */
export async function roadLegMinutes(points: LatLng[]): Promise<number[] | null> {
  if (!OSRM_URL || points.length < 2 || typeof fetch !== 'function') return null;

  const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
  const url = `${OSRM_URL}/route/v1/driving/${coords}?overview=false&annotations=duration`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: { legs?: { duration?: number }[] }[];
    };
    const legs = data?.routes?.[0]?.legs;
    // OSRM returns one leg per consecutive pair; bail if the shape is off.
    if (data.code !== 'Ok' || !legs || legs.length !== points.length - 1) return null;
    return legs.map((l) => Math.max(1, Math.round((l.duration ?? 0) / 60)));
  } catch {
    return null; // timeout, network error, bad JSON → fall back
  }
}
