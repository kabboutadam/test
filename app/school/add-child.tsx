/**
 * School operator: add or edit a child. The operator picks a route, enters the
 * parent's phone (their login), and taps the map to drop the pickup pin at the
 * child's home. Editing supports name/grade/address and moving the pin; the
 * route and parent are fixed once created (re-add to change them).
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as api from '@/api/client';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme/theme';

const BEIRUT: Region = {
  latitude: 33.8886,
  longitude: 35.4955,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

type Pin = { latitude: number; longitude: number };

export default function SchoolAddChild() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const editing = !!childId;

  const [routes, setRoutes] = useState<api.AdminOverview['routes']>([]);
  const [region, setRegion] = useState<Region>(BEIRUT);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [routeId, setRouteId] = useState<string | null>(null);
  const [parentPhone, setParentPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState<Pin | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const overview = await api.adminOverview(token);
        setRoutes(overview.routes);
        if (overview.school) {
          setRegion({ ...overview.school.location, latitudeDelta: 0.05, longitudeDelta: 0.05 });
        }
        if (editing) {
          const kids = await api.adminListChildren(token);
          const child = kids.find((c) => c.id === childId);
          if (child) {
            setName(child.name);
            setGrade(child.grade === '—' ? '' : child.grade);
            setRouteId(child.routeId);
            setParentPhone(child.parentPhone ?? '');
            setAddress(child.address ?? '');
            if (child.location) {
              setPin(child.location);
              setRegion({ ...child.location, latitudeDelta: 0.02, longitudeDelta: 0.02 });
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token, editing, childId]);

  const canSubmit = useMemo(
    () => !!name.trim() && !!pin && !busy && (editing || (!!routeId && !!parentPhone.trim())),
    [name, pin, busy, editing, routeId, parentPhone],
  );

  async function submit() {
    if (!token || !pin) return;
    setBusy(true);
    setError(null);
    try {
      if (editing && childId) {
        await api.adminUpdateChild(token, childId, {
          name: name.trim(),
          grade: grade.trim(),
          address: address.trim(),
          latitude: pin.latitude,
          longitude: pin.longitude,
        });
      } else {
        if (!routeId) throw new Error('route');
        await api.adminAddChild(token, {
          name: name.trim(),
          grade: grade.trim(),
          routeId,
          parentPhone: parentPhone.trim(),
          address: address.trim() || undefined,
          latitude: pin.latitude,
          longitude: pin.longitude,
        });
      }
      router.back();
    } catch {
      setError('Could not save — check the details and try again.');
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: editing ? 'Edit child' : 'Add child' }} />

      <Text style={styles.label}>Child</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" editable={!busy} />
      <TextInput style={styles.input} value={grade} onChangeText={setGrade} placeholder="Grade (e.g. Grade 3)" editable={!busy} />

      {editing ? (
        <>
          <Text style={styles.label}>Route</Text>
          <Text style={styles.readonly}>{routes.find((r) => r.id === routeId)?.name ?? '—'}</Text>
          <Text style={styles.label}>Parent phone</Text>
          <Text style={styles.readonly}>{parentPhone || '—'}</Text>
        </>
      ) : (
        <>
          <Text style={styles.label}>Route</Text>
          {routes.length === 0 ? (
            <Text style={styles.hint}>No routes yet. Add a route in the dashboard first.</Text>
          ) : (
            routes.map((r) => (
              <Pressable
                key={r.id}
                style={[styles.selectRow, routeId === r.id && styles.selectRowActive]}
                onPress={() => setRouteId(r.id)}
              >
                <Text style={[styles.selectText, routeId === r.id && styles.selectTextActive]}>{r.name}</Text>
              </Pressable>
            ))
          )}

          <Text style={styles.label}>Parent phone (their login)</Text>
          <TextInput
            style={styles.input}
            value={parentPhone}
            onChangeText={setParentPhone}
            placeholder="+961 …"
            keyboardType="phone-pad"
            editable={!busy}
          />
        </>
      )}

      <Text style={styles.label}>Home address (label)</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="e.g. Hamra, Rue Jeanne d'Arc" editable={!busy} />

      <Text style={styles.label}>Pickup pin</Text>
      <Text style={styles.hint}>Tap the map to place the pin at the child's home. Drag to fine-tune.</Text>
      <View style={styles.mapWrap}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          initialRegion={region}
          onPress={(e) => setPin(e.nativeEvent.coordinate)}
        >
          {pin && (
            <Marker
              coordinate={pin}
              draggable
              onDragEnd={(e) => setPin(e.nativeEvent.coordinate)}
            />
          )}
        </MapView>
      </View>
      <Text style={styles.coords}>
        {pin ? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}` : 'No pin yet'}
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.cta, !canSubmit && styles.ctaDisabled]} onPress={submit} disabled={!canSubmit}>
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.ctaText}>{editing ? 'Save changes' : 'Add child'}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xs },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  readonly: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  selectRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  selectRowActive: { borderColor: colors.primary },
  selectText: { fontSize: 15, color: colors.text },
  selectTextActive: { fontWeight: '700' },
  mapWrap: {
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  coords: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.sm },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
});
