/**
 * Background location for driver mode.
 *
 * A driving driver can't keep the app open, so instead of the foreground socket
 * we register an OS background-location task: iOS/Android keep delivering the
 * bus's GPS while the phone is locked or mounted, and the task POSTs each batch
 * to the server (`POST /driver/positions`). The server authorizes it against the
 * driver's route and broadcasts to parents — same pipeline as the live socket.
 *
 * This module must be imported once at app startup so the task is defined before
 * the OS tries to relaunch it (see app/_layout.tsx).
 */

import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';

import { apiUrl } from '@/api/config';

export const DRIVER_LOCATION_TASK = 'busmapp-driver-location';
const SESSION_KEY = 'driver.tracking.session'; // JSON { token, routeId }

interface DriverSession {
  token: string;
  routeId: string;
}

/** Persist the driver's token + route so the background task can authenticate
 * even after the OS relaunches it into a fresh JS context. */
export async function saveDriverSession(session: DriverSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}
async function readDriverSession(): Promise<DriverSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as DriverSession) : null;
  } catch {
    return null;
  }
}
async function clearDriverSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// The task runs in its own context each time the OS delivers locations.
TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  if (!locations || locations.length === 0) return;

  const session = await readDriverSession();
  if (!session) return;

  const points = locations.map((l) => ({
    latitude: l.coords.latitude,
    longitude: l.coords.longitude,
    speedKmh:
      l.coords.speed != null && l.coords.speed >= 0 ? l.coords.speed * 3.6 : undefined,
  }));

  try {
    await fetch(apiUrl('/driver/positions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ routeId: session.routeId, points }),
    });
  } catch {
    // Offline / server asleep: drop this batch. The next delivery carries the
    // latest fix, so a brief gap self-heals without queueing stale points.
  }
});

/** True if the background location task is currently running. */
export async function isDriverTracking(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  } catch {
    return false;
  }
}

/**
 * Start streaming the bus's location in the background. Assumes foreground (and,
 * ideally, background) location permission is already granted.
 */
export async function startDriverTracking(session: DriverSession): Promise<void> {
  await saveDriverSession(session);
  if (await isDriverTracking()) return; // already running
  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 4000,
    distanceInterval: 15,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    // Android needs a persistent foreground-service notification while tracking.
    foregroundService: {
      notificationTitle: 'BusMapp — sharing bus location',
      notificationBody: 'Parents can follow the bus while your route is active.',
      notificationColor: '#0B6E4F',
    },
  });
}

/** Stop background streaming and forget the stored session. */
export async function stopDriverTracking(): Promise<void> {
  if (await isDriverTracking()) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  }
  await clearDriverSession();
}
