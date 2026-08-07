/**
 * School operator home. Shown when a school logs in (role === 'operator').
 * Lists the school's children and links to the add/edit screen. Staff-facing,
 * so English only. Only reachable in backend mode.
 */

import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as api from '@/api/client';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme/theme';

export default function SchoolHome() {
  const { token, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [schoolName, setSchoolName] = useState('School');
  const [routes, setRoutes] = useState<api.AdminOverview['routes']>([]);
  const [children, setChildren] = useState<api.AdminChild[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [overview, kids] = await Promise.all([
        api.adminOverview(token),
        api.adminListChildren(token),
      ]);
      setSchoolName(overview.school?.name ?? 'School');
      setRoutes(overview.routes);
      setChildren(kids);
    } catch (err) {
      if (err instanceof api.ApiError && err.status === 401) await signOut();
    } finally {
      setLoading(false);
    }
  }, [token, signOut]);

  // Refetch whenever the screen regains focus (e.g. after adding a child).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmRemove(child: api.AdminChild) {
    Alert.alert('Remove child', `Remove ${child.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          await api.adminRemoveChild(token, child.id);
          setChildren((prev) => prev.filter((c) => c.id !== child.id));
        },
      },
    ]);
  }

  function confirmRemoveBus(route: api.AdminOverview['routes'][number]) {
    Alert.alert('Delete bus', `Delete “${route.name}”? This also removes its assigned vehicle/driver.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await api.adminDeleteRoute(token, route.id);
            setRoutes((prev) => prev.filter((r) => r.id !== route.id));
          } catch {
            Alert.alert('Could not delete', 'Move or remove this bus’s kids first.');
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>School</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {schoolName}
          </Text>
        </View>
        <Pressable onPress={signOut} hitSlop={10}>
          <Ionicons name="log-out-outline" size={24} color={colors.onPrimary} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Buses ({routes.length})</Text>
              <Link href="/school/add-bus" asChild>
                <Pressable style={styles.newBtn}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={styles.newBtnText}>Add bus</Text>
                </Pressable>
              </Link>
            </View>

            {routes.length === 0 ? (
              <Text style={styles.empty}>
                No buses yet. Tap “Add child” to start your first list, or “Add bus”.
              </Text>
            ) : (
              routes.map((route) => {
                const kids = children
                  .filter((c) => c.routeId === route.id)
                  .sort((a, b) => a.order - b.order);
                return (
                  <View key={route.id} style={styles.group}>
                    <View style={styles.groupHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.groupTitle}>{route.name}</Text>
                        <Text style={styles.groupMeta}>
                          {kids.length} kid{kids.length === 1 ? '' : 's'}
                          {route.plateNumber ? ` · ${route.plateNumber}` : ' · no bus assigned'}
                        </Text>
                      </View>
                      {kids.length > 0 && (
                        <Link
                          href={{ pathname: '/school/arrange', params: { routeId: route.id, name: route.name } }}
                          asChild
                        >
                          <Pressable style={styles.arrangeSm}>
                            <Ionicons name="swap-vertical" size={15} color={colors.onPrimary} />
                            <Text style={styles.arrangeSmText}>Arrange</Text>
                          </Pressable>
                        </Link>
                      )}
                    </View>

                    {kids.length === 0 ? (
                      <View style={styles.emptyRow}>
                        <Text style={styles.groupEmpty}>No kids on this bus yet.</Text>
                        <Pressable onPress={() => confirmRemoveBus(route)} hitSlop={8}>
                          <Text style={styles.deleteBus}>Delete bus</Text>
                        </Pressable>
                      </View>
                    ) : (
                      kids.map((item) => (
                        <Pressable
                          key={item.id}
                          style={styles.row}
                          onPress={() =>
                            router.push({ pathname: '/school/add-child', params: { childId: item.id } })
                          }
                        >
                          <View style={styles.orderBadge}>
                            <Text style={styles.orderBadgeText}>{item.order + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>
                              {item.name}
                              {item.scheduledTime ? `  ·  ${item.scheduledTime}` : ''}
                            </Text>
                            <Text style={styles.rowSub} numberOfLines={1}>
                              {item.address ?? 'Tap to set home pin'}
                            </Text>
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              {item.grade || '—'}
                              {item.parentPhone ? ` · ${item.parentPhone}` : ''}
                            </Text>
                          </View>
                          <Pressable onPress={() => confirmRemove(item)} hitSlop={10}>
                            <Ionicons name="trash-outline" size={20} color={colors.danger} />
                          </Pressable>
                        </Pressable>
                      ))
                    )}

                    <Link
                      href={{ pathname: '/school/add-child', params: { routeId: route.id } }}
                      asChild
                    >
                      <Pressable style={styles.addToBus}>
                        <Ionicons name="add" size={15} color={colors.primary} />
                        <Text style={styles.addToBusText}>Add child to {route.name}</Text>
                      </Pressable>
                    </Link>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      <Link href="/school/add-child" asChild>
        <Pressable style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}>
          <Ionicons name="add" size={22} color={colors.onPrimary} />
          <Text style={styles.fabText}>Add child</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLabel: { color: colors.onPrimary, fontSize: 12, opacity: 0.8 },
  headerTitle: { color: colors.onPrimary, fontSize: 20, fontWeight: '800' },
  body: { flex: 1, padding: spacing.lg },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  arrangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  arrangeText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  newBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  hintSmall: { fontSize: 13, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipName: { fontSize: 14, fontWeight: '700', color: colors.text, maxWidth: 180 },
  chipMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  empty: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
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
    marginBottom: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  group: { marginTop: spacing.lg },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  groupTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  groupMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  groupEmpty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  deleteBus: { fontSize: 13, fontWeight: '700', color: colors.danger },
  arrangeSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  arrangeSmText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: { fontSize: 13, fontWeight: '800', color: colors.text },
  addToBus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addToBusText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: colors.onPrimary, fontWeight: '800', fontSize: 15 },
});
