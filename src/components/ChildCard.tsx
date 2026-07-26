import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n/I18nContext';
import { arrivalLabelKey } from '@/i18n/strings';
import { Child, RouteSession } from '@/models/types';
import { ArrivalInfo } from '@/services/stopsAway';
import { colors, radius, spacing } from '@/theme/theme';

interface Props {
  child: Child;
  routeName: string;
  arrival: ArrivalInfo;
  session: RouteSession;
}

const phaseColor: Record<ArrivalInfo['phase'], string> = {
  arriving: colors.success,
  approaching: colors.warning,
  incoming: colors.primary,
  picked_up: colors.textMuted,
  not_started: colors.textMuted,
};

export function ChildCard({ child, routeName, arrival, session }: Props) {
  const { t } = useI18n();
  const initials = child.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  const { key, vars } = arrivalLabelKey(arrival, session);
  const statusLabel = t(key, vars);
  const eta =
    arrival.etaMinutes > 0 ? `  ·  ~${arrival.etaMinutes} ${t('common.min')}` : '';

  return (
    <Link href={`/track/${child.id}`} asChild>
      <Pressable style={styles.card}>
        <View style={[styles.avatar, { backgroundColor: child.color }]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{child.name}</Text>
          <Text style={styles.meta}>
            {child.grade} · {routeName}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: phaseColor[arrival.phase] },
              ]}
            />
            <Text
              style={[styles.status, { color: phaseColor[arrival.phase] }]}
            >
              {statusLabel}
              {eta}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
  },
});
