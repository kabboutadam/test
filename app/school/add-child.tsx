/**
 * School operator: add or edit a child. The operator picks a route, enters the
 * parent's phone (their login), and taps the map to drop the pickup pin at the
 * child's home. Editing supports name/grade/address and moving the pin; the
 * route and parent are fixed once created (re-add to change them).
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

/** Look up a place in Lebanon via OpenStreetMap's free geocoder. Used only to
 * jump the map near a typed landmark — the operator still sets the exact pin. */
async function geocodeLebanon(q: string): Promise<Pin | null> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=lb&q=' +
    encodeURIComponent(q);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (arr && arr[0]) {
    return { latitude: parseFloat(arr[0].lat), longitude: parseFloat(arr[0].lon) };
  }
  return null;
}

export default function SchoolAddChild() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const editing = !!childId;

  const [region, setRegion] = useState<Region>(BEIRUT);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState<Pin | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  async function findPlace() {
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    setSearchNote(null);
    try {
      const hit = await geocodeLebanon(q);
      if (!hit) {
        setSearchNote('Place not found — try a nearby landmark.');
        return;
      }
      const r = { latitude: hit.latitude, longitude: hit.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      mapRef.current?.animateToRegion(r, 500);
      setPin({ latitude: hit.latitude, longitude: hit.longitude });
    } catch {
      setSearchNote('Search failed — check your connection.');
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const overview = await api.adminOverview(token);
        if (overview.school) {
          setRegion({ ...overview.school.location, latitudeDelta: 0.05, longitudeDelta: 0.05 });
        }
        if (editing) {
          const kids = await api.adminListChildren(token);
          const child = kids.find((c) => c.id === childId);
          if (child) {
            setName(child.name);
            setGrade(child.grade === '—' ? '' : child.grade);
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
    () => !!name.trim() && !!pin && !busy && (editing || !!parentPhone.trim()),
    [name, pin, busy, editing, parentPhone],
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
        // No route to pick — the child joins the school's pickup list.
        await api.adminAddChild(token, {
          name: name.trim(),
          grade: grade.trim(),
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
          <Text style={styles.label}>Parent phone</Text>
          <Text style={styles.readonly}>{parentPhone || '—'}</Text>
        </>
      ) : (
        <>
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
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search a place (e.g. Sagesse Achrafieh)"
          editable={!busy}
          returnKeyType="search"
          onSubmitEditing={findPlace}
        />
        <Pressable style={styles.searchBtn} onPress={findPlace} disabled={searching}>
          {searching ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={styles.searchBtnText}>Find</Text>
          )}
        </Pressable>
      </View>
      {searchNote && <Text style={styles.hint}>{searchNote}</Text>}
      <Text style={styles.hint}>Then tap the map to fine-tune the pin at the child's home.</Text>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
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
  newRouteBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  newRouteText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  searchBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
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
