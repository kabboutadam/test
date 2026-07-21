import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChildCard } from '@/components/ChildCard';
import { findRoute, findStopIndex } from '@/data/mockData';
import { computeArrival } from '@/services/stopsAway';
import { entitles, statusLabel } from '@/services/subscription';
import { useApp } from '@/store/AppContext';
import { colors, radius, spacing } from '@/theme/theme';

export default function HomeScreen() {
  const { children, positions, subscription } = useApp();
  const insets = useSafeAreaInsets();
  const unlocked = entitles(subscription);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <SubscriptionBanner
        unlocked={unlocked}
        label={statusLabel(subscription)}
      />

      <Text style={styles.sectionTitle}>Live buses</Text>

      {children.map((child) => {
        const route = findRoute(child.routeId)!;
        const position = positions[child.routeId];
        const childStopIndex = findStopIndex(route, child.stopId);
        const arrival = position
          ? computeArrival(position, route, childStopIndex)
          : {
              stopsAway: childStopIndex,
              etaMinutes: 0,
              phase: 'not_started' as const,
              label: 'Connecting…',
            };

        return (
          <View key={child.id} style={styles.cardWrap}>
            <ChildCard child={child} routeName={route.name} arrival={arrival} />
          </View>
        );
      })}
    </ScrollView>
  );
}

function SubscriptionBanner({
  unlocked,
  label,
}: {
  unlocked: boolean;
  label: string;
}) {
  return (
    <Link href="/paywall" asChild>
      <View style={styles.banner}>
        <Ionicons
          name={unlocked ? 'shield-checkmark' : 'lock-closed'}
          size={20}
          color={unlocked ? colors.success : colors.warning}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>
            {unlocked ? 'Tracking active' : 'Tracking locked'}
          </Text>
          <Text style={styles.bannerSub}>{label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  bannerSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  cardWrap: {
    marginBottom: spacing.sm,
  },
});
