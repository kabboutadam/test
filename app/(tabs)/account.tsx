import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { config } from '@/api/config';
import { entitles, statusLabel } from '@/services/subscription';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme/theme';

export default function AccountScreen() {
  const { parent, children, subscription, resetSimulation, positionMode } =
    useApp();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {parent.name
              .split(' ')
              .map((p) => p[0])
              .join('')}
          </Text>
        </View>
        <Text style={styles.name}>{parent.name}</Text>
        <Text style={styles.meta}>{parent.email}</Text>
        <Text style={styles.meta}>{parent.phone}</Text>
      </View>

      <Text style={styles.sectionTitle}>Subscription</Text>
      <Link href="/paywall" asChild>
        <Pressable style={styles.row}>
          <Ionicons
            name={entitles(subscription) ? 'shield-checkmark' : 'lock-closed'}
            size={20}
            color={entitles(subscription) ? colors.success : colors.warning}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Manage plan</Text>
            <Text style={styles.rowSub}>{statusLabel(subscription)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </Link>

      <Text style={styles.sectionTitle}>Children ({children.length})</Text>
      {children.map((c) => (
        <View key={c.id} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: c.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{c.name}</Text>
            <Text style={styles.rowSub}>{c.grade}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Demo controls</Text>
      <Pressable style={styles.row} onPress={resetSimulation}>
        <Ionicons name="refresh" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Restart bus simulation</Text>
          <Text style={styles.rowSub}>
            {positionMode === 'backend'
              ? 'Positions come from the backend (server owns the sim)'
              : 'Send both buses back to their first stop'}
          </Text>
        </View>
      </Pressable>

      <Link href="/driver" asChild>
        <Pressable style={styles.row}>
          <Ionicons name="bus" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Driver mode</Text>
            <Text style={styles.rowSub}>Stream this bus’s location to parents</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </Link>

      {config.useBackend && (
        <Pressable style={styles.row} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.danger }]}>Sign out</Text>
          </View>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
  profile: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { color: colors.onPrimary, fontSize: 26, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  meta: { fontSize: 14, color: colors.textMuted },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  dot: { width: 20, height: 20, borderRadius: 10 },
});
