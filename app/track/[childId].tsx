import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusMap } from '@/components/BusMap';
import { RouteProgress } from '@/components/RouteProgress';
import { StopsAwayBadge } from '@/components/StopsAwayBadge';
import { findBusByRoute, findChild, findRoute, findStopIndex } from '@/data/mockData';
import { computeArrival } from '@/services/stopsAway';
import { entitles } from '@/services/subscription';
import { useApp } from '@/store/AppContext';
import { colors, radius, spacing } from '@/theme/theme';

type ViewMode = 'map' | 'stops';

export default function TrackScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { positions, subscription } = useApp();
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState<ViewMode>('map');

  const child = childId ? findChild(childId) : undefined;
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

  return (
    <>
      <Stack.Screen options={{ title: child.name }} />
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

        {bus && (
          <View style={styles.busCard}>
            <View style={styles.busIcon}>
              <Ionicons name="bus" size={22} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.busTitle}>{bus.plateNumber}</Text>
              <Text style={styles.busMeta}>
                {bus.driverName} · {bus.driverPhone}
              </Text>
            </View>
          </View>
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
