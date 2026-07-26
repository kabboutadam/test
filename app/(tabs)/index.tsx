import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChildCard } from '@/components/ChildCard';
import { findStopIndex, routeForChild } from '@/data/mockData';
import { useI18n } from '@/i18n/I18nContext';
import { RouteSession } from '@/models/types';
import { computeArrival } from '@/services/stopsAway';
import { entitles, statusLabel } from '@/services/subscription';
import { useApp } from '@/store/AppContext';
import { colors, radius, spacing } from '@/theme/theme';

export default function HomeScreen() {
  const { children, positions, subscription, session, setSession } = useApp();
  const { t } = useI18n();
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

      <SessionToggle value={session} onChange={setSession} />

      <Text style={styles.sectionTitle}>{t('home.liveBuses')}</Text>

      {children.map((child) => {
        const { route, stopId } = routeForChild(child, session);
        const position = positions[route.id];
        const childStopIndex = findStopIndex(route, stopId);
        const arrival = position
          ? computeArrival(position, route, childStopIndex)
          : {
              stopsAway: childStopIndex,
              etaMinutes: 0,
              phase: 'not_started' as const,
              label: t('home.connecting'),
            };

        return (
          <View key={child.id} style={styles.cardWrap}>
            <ChildCard
              child={child}
              routeName={route.name}
              arrival={arrival}
              session={session}
            />
          </View>
        );
      })}

      {children.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="bus-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>{t('home.empty')}</Text>
        </View>
      )}

      <Link href="/add-child" asChild>
        <Pressable style={styles.addButton}>
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={styles.addButtonText}>{t('home.addChild')}</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

function SessionToggle({
  value,
  onChange,
}: {
  value: RouteSession;
  onChange: (s: RouteSession) => void;
}) {
  const { t } = useI18n();
  const options: { key: RouteSession; icon: 'sunny' | 'moon'; label: string }[] =
    [
      { key: 'morning', icon: 'sunny', label: t('session.morning') },
      { key: 'afternoon', icon: 'moon', label: t('session.afternoon') },
    ];
  return (
    <View style={styles.sessionToggle}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.sessionItem, active && styles.sessionItemActive]}
          >
            <Ionicons
              name={opt.icon}
              size={16}
              color={active ? colors.onPrimary : colors.textMuted}
            />
            <Text
              style={[
                styles.sessionText,
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

function SubscriptionBanner({
  unlocked,
  label,
}: {
  unlocked: boolean;
  label: string;
}) {
  const { t } = useI18n();
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
            {unlocked ? t('home.trackingActive') : t('home.trackingLocked')}
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
  sessionToggle: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  sessionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  sessionItemActive: {
    backgroundColor: colors.primary,
  },
  sessionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardWrap: {
    marginBottom: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
