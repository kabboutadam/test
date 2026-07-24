import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusMap } from '@/components/BusMap';
import { RouteProgress } from '@/components/RouteProgress';
import { StopsAwayBadge } from '@/components/StopsAwayBadge';
import { findBusByRoute, findRoute, findStopIndex, schools } from '@/data/mockData';
import { computeArrival } from '@/services/stopsAway';
import { entitles } from '@/services/subscription';
import { useApp } from '@/store/AppContext';
import { colors, radius, spacing } from '@/theme/theme';

type ViewMode = 'map' | 'stops';

export default function TrackScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { positions, subscription, children } = useApp();
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState<ViewMode>('map');

  // Look up in the live child list so newly added/edited children work too.
  const child = children.find((c) => c.id === childId);
  if (!child) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Child not found.</Text>
      </View>
    );
  }

  if (!entitles(subscription)) {
    return <LockedState />;
  }

  const route = findRoute(child.routeId)!;
  const bus = findBusByRoute(child.routeId);
  const position = positions[child.routeId];
  const childStopIndex = findStopIndex(route, child.stopId);
  const childStop = route.stops[childStopIndex];
  const school = schools.find((s) => s.id === route.schoolId);

  function callDriver() {
    if (bus) Linking.openURL(`tel:${bus.driverPhone.replace(/\s/g, '')}`);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: child.name,
          headerRight: () => (
            <Link href={{ pathname: '/add-child', params: { childId: child.id } }}>
              <Text style={styles.headerEdit}>Edit</Text>
            </Link>
          ),
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {position ? (
          <View style={styles.hero}>
            <StopsAwayBadge arrival={computeArrival(position, route, childStopIndex)} />
            <Text style={styles.speed}>
              {position.status === 'en_route'
                ? `On the move · ${position.speedKmh} km/h`
                : position.status === 'at_stop'
                  ? 'Stopped to pick up'
                  : position.status === 'completed'
                    ? 'Route completed'
                    : 'Not started'}
            </Text>
          </View>
        ) : (
          <Text style={styles.muted}>Connecting to bus…</Text>
        )}

        <View style={styles.infoCard}>
          <InfoRow icon="school" label="School" value={school?.name ?? '—'} />
          <InfoRow icon="git-branch" label="Route" value={route.name} />
          <InfoRow
            icon="location"
            label="Boards at"
            value={childStop ? `${childStop.name} · ${childStop.scheduledTime}` : '—'}
          />
        </View>

        {bus && (
          <Pressable style={styles.busCard} onPress={callDriver}>
            <View style={styles.busIcon}>
              <Ionicons name="bus" size={22} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.busTitle}>{bus.plateNumber}</Text>
              <Text style={styles.busMeta}>{bus.driverName}</Text>
            </View>
            <View style={styles.callButton}>
              <Ionicons name="call" size={18} color={colors.onPrimary} />
            </View>
          </Pressable>
        )}

        <View style={styles.routeHeader}>
          <Text style={styles.sectionTitle}>Route</Text>
          <SegmentedToggle value={viewMode} onChange={setViewMode} />
        </View>

        {position && viewMode === 'map' && (
          <BusMap
            route={route}
            position={position}
            childStopIndex={childStopIndex}
          />
        )}

        {position && viewMode === 'stops' && (
          <View style={styles.routeCard}>
            <RouteProgress
              route={route}
              position={position}
              childStopIndex={childStopIndex}
            />
          </View>
        )}
      </ScrollView>
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SegmentedToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const options: { key: ViewMode; icon: 'map' | 'list'; label: string }[] = [
    { key: 'map', icon: 'map', label: 'Map' },
    { key: 'stops', icon: 'list', label: 'Stops' },
  ];
  return (
    <View style={styles.segment}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
          >
            <Ionicons
              name={opt.icon}
              size={15}
              color={active ? colors.onPrimary : colors.textMuted}
            />
            <Text
              style={[
                styles.segmentText,
                { color: active ? colors.onPrimary : colors.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LockedState() {
  return (
    <View style={styles.centered}>
      <Ionicons name="lock-closed" size={48} color={colors.warning} />
      <Text style={styles.lockedTitle}>Live tracking is locked</Text>
      <Text style={styles.muted}>
        Subscribe to see your child&apos;s bus in real time.
      </Text>
      <Link href="/paywall" style={styles.lockedButton}>
        <Text style={styles.lockedButtonText}>View plans</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  speed: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  busCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  busIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  busMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  infoLabel: { fontSize: 13, color: colors.textMuted, width: 72 },
  infoValue: { fontSize: 14, color: colors.text, fontWeight: '600', flex: 1 },
  headerEdit: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  routeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muted: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  lockedTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  lockedButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  lockedButtonText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
});
