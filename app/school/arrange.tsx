/**
 * Arrange pickup order + times. The school orders its kids (move up/down),
 * sets a "be at school by" time, and the app computes each child's pickup time
 * (distance-based ETA, worked backward from arrival). No routes to think about.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
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
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme/theme';

interface Row {
  id: string;
  name: string;
  address: string | null;
  scheduledTime: string | null;
}

export default function ArrangeScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [arrival, setArrival] = useState('07:30');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const kids = await api.adminListChildren(token);
    setRows(
      kids
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ id: c.id, name: c.name, address: c.address, scheduledTime: c.scheduledTime })),
    );
    setLoading(false);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function move(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= rows.length) return;
    const next = rows.slice();
    [next[index], next[to]] = [next[to], next[index]];
    setRows(next);
  }

  async function save() {
    if (!token || rows.length === 0) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await api.adminArrange(token, {
        childIds: rows.map((r) => r.id),
        schoolArrival: arrival.trim() || '07:30',
      });
      const timeById = new Map(result.map((r) => [r.childId, r.scheduledTime]));
      setRows((prev) => prev.map((r) => ({ ...r, scheduledTime: timeById.get(r.id) ?? r.scheduledTime })));
      setNote('Order saved — pickup times updated.');
    } catch {
      setNote('Could not save. Check the time is HH:MM and try again.');
    } finally {
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
      <Stack.Screen options={{ title: 'Pickup order & times' }} />

      <Text style={styles.intro}>
        Put the kids in the order the bus picks them up (first at the top). Set
        when the bus should reach school, and we'll time every pickup.
      </Text>

      <View style={styles.arrivalRow}>
        <Text style={styles.arrivalLabel}>Be at school by</Text>
        <TextInput
          style={styles.arrivalInput}
          value={arrival}
          onChangeText={setArrival}
          placeholder="07:30"
          keyboardType="numbers-and-punctuation"
          editable={!busy}
        />
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>No children yet. Add kids first, then arrange them here.</Text>
      ) : (
        rows.map((r, i) => (
          <View key={r.id} style={styles.row}>
            <View style={styles.orderCol}>
              <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6}>
                <Ionicons name="chevron-up" size={20} color={i === 0 ? colors.border : colors.primary} />
              </Pressable>
              <Text style={styles.orderNum}>{i + 1}</Text>
              <Pressable onPress={() => move(i, 1)} disabled={i === rows.length - 1} hitSlop={6}>
                <Ionicons name="chevron-down" size={20} color={i === rows.length - 1 ? colors.border : colors.primary} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.name}</Text>
              {!!r.address && <Text style={styles.addr} numberOfLines={1}>{r.address}</Text>}
            </View>
            <Text style={styles.time}>{r.scheduledTime || '—'}</Text>
          </View>
        ))
      )}

      {note && <Text style={styles.note}>{note}</Text>}

      {rows.length > 0 && (
        <Pressable style={[styles.cta, busy && styles.ctaDisabled]} onPress={save} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.ctaText}>Save order & calculate times</Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  intro: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.md },
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  arrivalLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  arrivalInput: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'right',
    minWidth: 90,
    paddingVertical: spacing.sm,
  },
  empty: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  orderCol: { alignItems: 'center', width: 34 },
  orderNum: { fontSize: 15, fontWeight: '800', color: colors.text, marginVertical: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  addr: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  time: { fontSize: 16, fontWeight: '800', color: colors.primary, minWidth: 54, textAlign: 'right' },
  note: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
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
