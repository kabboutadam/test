/**
 * Driver mode. A driver picks the route they're running and starts streaming
 * location to the backend. Two sources:
 *   - "Simulate route" walks synthetic GPS along the route (useful for demos on
 *     a stationary device, or when you're not physically in Beirut).
 *   - "Device GPS" streams the phone's real location (expo-location).
 *
 * Either way it emits `driver:gps`, which the server snaps onto the route.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { config } from '@/api/config';
import { DriverClient } from '@/api/driverClient';
import { routes } from '@/data/mockData';
import { LatLng, Route } from '@/models/types';
import { lerpLatLng } from '@/services/geo';
import { colors, radius, spacing } from '@/theme/theme';

type Mode = 'simulate' | 'device';

export default function DriverScreen() {
  const insets = useSafeAreaInsets();
  const clientRef = useRef<DriverClient | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const progressRef = useRef(0); // float index along the route for simulate mode

  const [routeId, setRouteId] = useState(routes[0].id);
  const [mode, setMode] = useState<Mode>('simulate');
  const [streaming, setStreaming] = useState(false);
  const [pointsSent, setPointsSent] = useState(0);
  const [status, setStatus] = useState('Idle');

  const route = routes.find((r) => r.id === routeId)!;

  useEffect(() => {
    clientRef.current = new DriverClient();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    const client = clientRef.current!;
    client.connect();
    progressRef.current = 0;
    setPointsSent(0);
    setStreaming(true);

    if (mode === 'simulate') {
      setStatus('Streaming simulated GPS');
      intervalRef.current = setInterval(() => {
        const { location, done } = walkRoute(route, progressRef);
        client.sendGps(routeId, location, 25);
        setPointsSent((n) => n + 1);
        if (done) setStatus('Reached school — still streaming');
      }, 1000);
      return;
    }

    // Device GPS
    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    if (perm !== 'granted') {
      setStatus('Location permission denied');
      setStreaming(false);
      return;
    }
    setStatus('Streaming device GPS');
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 5 },
      (pos) => {
        const location: LatLng = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        const speedKmh = pos.coords.speed != null ? Math.max(0, pos.coords.speed * 3.6) : undefined;
        client.sendGps(routeId, location, speedKmh);
        setPointsSent((n) => n + 1);
      },
    );
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    watchRef.current?.remove();
    watchRef.current = null;
    clientRef.current?.disconnect();
    setStreaming(false);
    setStatus('Idle');
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Driver mode' }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <Text style={styles.sectionTitle}>Your route</Text>
        {routes.map((r) => (
          <Pressable
            key={r.id}
            style={[styles.row, routeId === r.id && styles.rowSelected]}
            onPress={() => !streaming && setRouteId(r.id)}
          >
            <Ionicons
              name={routeId === r.id ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={routeId === r.id ? colors.primary : colors.border}
            />
            <Text style={styles.rowTitle}>{r.name}</Text>
          </Pressable>
        ))}

        <Text style={styles.sectionTitle}>Location source</Text>
        <View style={styles.segment}>
          {(['simulate', 'device'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              disabled={streaming}
              onPress={() => setMode(m)}
              style={[styles.segmentItem, mode === m && styles.segmentItemActive]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: mode === m ? colors.onPrimary : colors.textMuted },
                ]}
              >
                {m === 'simulate' ? 'Simulate route' : 'Device GPS'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: streaming ? colors.success : colors.textMuted },
              ]}
            />
            <Text style={styles.statusText}>{status}</Text>
          </View>
          <Text style={styles.statusMeta}>Points sent: {pointsSent}</Text>
          <Text style={styles.statusMeta}>Server: {config.apiBaseUrl}</Text>
        </View>

        <Pressable
          style={[styles.cta, streaming && styles.ctaStop]}
          onPress={streaming ? stop : start}
        >
          <Ionicons
            name={streaming ? 'stop-circle' : 'play-circle'}
            size={20}
            color={colors.onPrimary}
          />
          <Text style={styles.ctaText}>
            {streaming ? 'Stop route' : 'Start route'}
          </Text>
        </Pressable>

        <Text style={styles.hint}>
          Parents watching this route will see the bus update from a live driver
          feed. Turn on “Use backend” in app.json to watch it in the parent app.
        </Text>
      </ScrollView>
    </>
  );
}

/**
 * Advance a float index along the route and return the interpolated point.
 * Mutates progressRef; ~0.03 index/tick ≈ a stop every few seconds.
 */
function walkRoute(
  route: Route,
  progressRef: React.MutableRefObject<number>,
): { location: LatLng; done: boolean } {
  const maxIndex = route.stops.length - 1;
  progressRef.current = Math.min(progressRef.current + 0.03 * 5, maxIndex);
  const i = Math.min(Math.floor(progressRef.current), maxIndex - 1);
  const frac = progressRef.current - i;
  const location = lerpLatLng(
    route.stops[i].location,
    route.stops[i + 1].location,
    frac,
  );
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.primary },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
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
  ctaText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
