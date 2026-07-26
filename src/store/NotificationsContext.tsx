/**
 * Arrival notifications.
 *
 * - Simulator mode: fires **local** notifications from the position stream while
 *   the app is open (works in Expo Go, no server, no EAS project).
 * - Backend mode: registers this device's Expo push token so the **server**
 *   sends push (works with the app closed). Local firing is disabled to avoid
 *   double notifications.
 *
 * Both paths use the same thresholds (3 stops, 1 stop, arriving).
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as api from '@/api/client';
import { config } from '@/api/config';
import { findStopIndex, routeForChild } from '@/data/mockData';
import { ArrivalNotifier } from '@/services/arrivalNotifier';
import { computeArrival } from '@/services/stopsAway';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ENABLED_KEY = 'busmapp.notify';

interface NotificationsState {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { positions, children: kids, session } = useApp();
  const { token } = useAuth();
  const [enabled, setEnabledState] = useState(true);
  const [granted, setGranted] = useState(false);
  const notifierRef = useRef(new ArrivalNotifier());

  // Load persisted preference.
  useEffect(() => {
    SecureStore.getItemAsync(ENABLED_KEY).then((v) => {
      if (v != null) setEnabledState(v === '1');
    });
  }, []);

  // Ask for permission when enabled.
  useEffect(() => {
    if (!enabled) return;
    (async () => {
      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        status = (await Notifications.requestPermissionsAsync()).status;
      }
      setGranted(status === 'granted');
    })();
  }, [enabled]);

  // Backend mode: register this device's Expo push token with the server.
  useEffect(() => {
    if (!enabled || !granted || !config.useBackend || !token) return;
    (async () => {
      try {
        if (!Device.isDevice) return; // push tokens require a physical device
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as
          | string
          | undefined;
        const { data } = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        await api.registerPushToken(token, data);
      } catch {
        // Without an EAS projectId a remote token can't be minted; skip quietly.
      }
    })();
  }, [enabled, granted, token]);

  // Simulator mode: fire local notifications as the bus approaches.
  useEffect(() => {
    if (!enabled || !granted || config.useBackend) return;
    for (const child of kids) {
      const { route, stopId } = routeForChild(child, session);
      const position = positions[route.id];
      if (!position) continue;
      const arrival = computeArrival(
        position,
        route,
        findStopIndex(route, stopId),
      );
      // Key on session too so a morning/afternoon switch tracks fresh thresholds.
      const msg = notifierRef.current.evaluate(
        `${child.id}:${session}`,
        child.name,
        arrival,
      );
      if (msg) {
        void Notifications.scheduleNotificationAsync({
          content: { title: msg.title, body: msg.body, data: { childId: child.id } },
          trigger: null, // deliver now
        });
      }
    }
  }, [positions, kids, enabled, granted, session]);

  const value = useMemo<NotificationsState>(
    () => ({
      enabled,
      setEnabled: (v: boolean) => {
        setEnabledState(v);
        void SecureStore.setItemAsync(ENABLED_KEY, v ? '1' : '0');
      },
    }),
    [enabled],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
