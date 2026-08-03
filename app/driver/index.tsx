/**
 * Driver mode. A driver signs in with their phone (a number registered as a
 * bus's driverPhone) and receives a driver token scoped to that bus's route.
 * They then stream location — the server only accepts GPS for their own route.
 *
 * Two sources: "Simulate route" walks synthetic GPS along the route (demo on a
 * stationary device); "Device GPS" streams the phone's real location.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as api from '@/api/client';
import { config } from '@/api/config';
import { DriverClient } from '@/api/driverClient';
import { LatLng, Route } from '@/models/types';
import { useAuth } from '@/store/AuthContext';
import { lerpLatLng } from '@/services/geo';
import {
  isDriverTracking,
  startDriverTracking,
  stopDriverTracking,
} from '@/services/driverLocationTask';
import { colors, radius, spacing } from '@/theme/theme';

type Mode = 'simulate' | 'device';
export default function DriverScreen() {
  const insets = useSafeAreaInsets();
  const { token, routeId, signOut } = useAuth();

  return (
    <>
      <Stack.Screen options={{ title: 'Driver mode' }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {token && routeId ? (
          <Streamer token={token} routeId={routeId} onSignOut={signOut} />
        ) : (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        )}
      </ScrollView>
    </>
  );
}

function Streamer({
  token,
  routeId,
  onSignOut,
}: {
  token: string;
  routeId: string;
  onSignOut: () => void;
}) {
  const clientRef = useRef<DriverClient | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);

  const [mode, setMode] = useState<Mode>('device');
  const [streaming, setStreaming] = useState(false);
  const [pointsSent, setPointsSent] = useState(0);
  const [status, setStatus] = useState('Idle');
  const [route, setRoute] = useState<Route | null>(null);

  // Load the driver's assigned route from the server (works for real routes).
  useEffect(() => {
    let active = true;
    api.fetchRoute(routeId).then((r) => active && setRoute(r)).catch(() => {});
    return () => {
      active = false;
    };
  }, [routeId]);

  useEffect(() => {
    clientRef.current = new DriverClient();
    // If background tracking is already running (app was reopened mid-route),
    // reflect that so the driver can stop it.
    isDriverTracking().then((active) => {
      if (active) {
        setMode('device');
        setStreaming(true);
        setStatus('Sharing live location (background)');
      }
    });
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clientRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    if (!route) return;

    // Simulated GPS stays a foreground socket stream — it's just for demos.
    if (mode === 'simulate') {
      const client = clientRef.current!;
      client.connect(token);
      progressRef.current = 0;
      setPointsSent(0);
      setStreaming(true);
      setStatus('Streaming simulated GPS');
      intervalRef.current = setInterval(() => {
        const { location, done } = walkRoute(route, progressRef);
        client.sendGps(routeId, location, 25);
        setPointsSent((n) => n + 1);
        if (done) setStatus('Reached school — still streaming');
      }, 1000);
      return;
    }

    // Real GPS uses a background task so it keeps streaming with the phone
    // locked or the app in the background.
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      setStatus('Location permission denied');
      return;
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    try {
      await startDriverTracking({ token, routeId });
      setStreaming(true);
      setStatus(
        bg.status === 'granted'
          ? 'Sharing live location — you can lock the phone'
          : 'Sharing live location (foreground only — allow “Always” to keep it running locked)',
      );
    } catch {
      setStatus('Could not start location — check permissions');
    }
  }

  async function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    clientRef.current?.disconnect();
    await stopDriverTracking().catch(() => {});
    setStreaming(false);
    setStatus('Idle');
  }

  if (!route) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />;
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.sectionTitle}>Your route</Text>
      <View style={styles.routeCard}>
        <Ionicons name="bus" size={20} color={colors.primary} />
        <Text style={styles.rowTitle}>{route.name}</Text>
      </View>

      <Text style={styles.sectionTitle}>Location source</Text>
      <View style={styles.segment}>
        {(['simulate', 'device'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            disabled={streaming}
            onPress={() => setMode(m)}
            style={[styles.segmentItem, mode === m && styles.segmentItemActive]}
          >
            <Text style={[styles.segmentText, { color: mode === m ? colors.onPrimary : colors.textMuted }]}>
              {m === 'simulate' ? 'Simulate route' : 'Device GPS'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: streaming ? colors.success : colors.textMuted }]} />
          <Text style={styles.statusText}>{status}</Text>
        </View>
        {mode === 'simulate' && <Text style={styles.statusMeta}>Points sent: {pointsSent}</Text>}
        <Text style={styles.statusMeta}>Server: {config.apiBaseUrl}</Text>
      </View>

      {mode === 'device' && (
        <Text style={styles.hint}>
          Keep this app running (locked screen is fine — mount the phone in the
          bus). Tracking shares the bus location with parents only while your
          route is active; tap Stop when you're done.
        </Text>
      )}

      <Pressable style={[styles.cta, streaming && styles.ctaStop]} onPress={streaming ? stop : start}>
        <Ionicons name={streaming ? 'stop-circle' : 'play-circle'} size={20} color={colors.onPrimary} />
        <Text style={styles.ctaText}>{streaming ? 'Stop route' : 'Start route'}</Text>
      </Pressable>

      {!streaming && (
        <Pressable onPress={onSignOut}>
          <Text style={styles.link}>Sign out of driver mode</Text>
        </Pressable>
      )}
    </View>
  );
}

function walkRoute(
  route: Route,
  progressRef: React.MutableRefObject<number>,
): { location: LatLng; done: boolean } {
  const maxIndex = route.stops.length - 1;
  progressRef.current = Math.min(progressRef.current + 0.03 * 5, maxIndex);
  const i = Math.min(Math.floor(progressRef.current), maxIndex - 1);
  const frac = progressRef.current - i;
  const location = lerpLatLng(route.stops[i].location, route.stops[i + 1].location, frac);
  return { location, done: progressRef.current >= maxIndex };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
  },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  segmentItemActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: '700' },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 15, fontWeight: '700', color: colors.text },
  statusMeta: { fontSize: 13, color: colors.textMuted },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  ctaStop: { backgroundColor: colors.danger },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 13, color: colors.textMuted },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
