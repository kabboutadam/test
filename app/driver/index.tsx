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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as api from '@/api/client';
import { config } from '@/api/config';
import { DriverClient } from '@/api/driverClient';
import { LatLng, Route } from '@/models/types';
import { lerpLatLng } from '@/services/geo';
import { colors, radius, spacing } from '@/theme/theme';

type Mode = 'simulate' | 'device';
const DEMO_DRIVER_PHONE = '+961 3 000 111'; // bus_a driver → Route A

export default function DriverScreen() {
  const insets = useSafeAreaInsets();

  // Driver auth (separate from the parent session).
  const [token, setToken] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);

  return (
    <>
      <Stack.Screen options={{ title: 'Driver mode' }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {token && routeId ? (
          <Streamer token={token} routeId={routeId} onSignOut={() => { setToken(null); setRouteId(null); }} />
        ) : (
          <DriverSignIn
            onSignedIn={(t, r) => {
              setToken(t);
              setRouteId(r);
            }}
          />
        )}
      </ScrollView>
    </>
  );
}

function DriverSignIn({ onSignedIn }: { onSignedIn: (token: string, routeId: string) => void }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState(DEMO_DRIVER_PHONE);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const { devCode } = await api.requestOtp(phone);
      if (devCode) setCode(devCode);
      setStep('code');
    } catch {
      setError('Network error — is the server running?');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.verifyOtp(phone, code.trim());
      if (res.role !== 'driver' || !res.routeId) {
        setError('This number is not registered as a driver.');
        return;
      }
      onSignedIn(res.token, res.routeId);
    } catch {
      setError('Invalid or expired code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={styles.sectionTitle}>Driver sign in</Text>
      <Text style={styles.hint}>
        Sign in with your driver phone. You can only stream your assigned bus.
      </Text>
      <TextInput
        style={styles.input}
        value={step === 'phone' ? phone : code}
        onChangeText={step === 'phone' ? setPhone : setCode}
        placeholder={step === 'phone' ? '+961 …' : '6-digit code'}
        keyboardType={step === 'phone' ? 'phone-pad' : 'number-pad'}
        editable={!busy}
        autoFocus
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.cta, busy && styles.ctaDisabled]} onPress={step === 'phone' ? send : verify} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.ctaText}>{step === 'phone' ? 'Send code' : 'Verify'}</Text>
        )}
      </Pressable>
    </View>
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
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const progressRef = useRef(0);

  const [mode, setMode] = useState<Mode>('simulate');
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
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    if (!route) return;
    const client = clientRef.current!;
    client.connect(token);
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
        <Text style={styles.statusMeta}>Points sent: {pointsSent}</Text>
        <Text style={styles.statusMeta}>Server: {config.apiBaseUrl}</Text>
      </View>

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
