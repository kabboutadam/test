/**
 * Add-child onboarding. Pick a school → a route at that school → the child's
 * stop, then name + grade. Submits through AppContext.addChild, which posts to
 * the backend (guarded /me/children) in backend mode, or appends locally in
 * simulator mode.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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

import { routes as allRoutes, schools } from '@/data/mockData';
import { useApp } from '@/store/AppContext';
import { colors, radius, spacing } from '@/theme/theme';

export default function AddChildScreen() {
  const { addChild } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schoolRoutes = useMemo(
    () => (schoolId ? allRoutes.filter((r) => r.schoolId === schoolId) : []),
    [schoolId],
  );
  const stops = useMemo(
    () => allRoutes.find((r) => r.id === routeId)?.stops ?? [],
    [routeId],
  );

  const canSubmit = name.trim() && routeId && stopId && !busy;

  async function submit() {
    if (!routeId || !stopId) return;
    setBusy(true);
    setError(null);
    try {
      await addChild({ name: name.trim(), grade: grade.trim(), routeId, stopId });
      router.back();
    } catch {
      setError('Could not add child — is the server reachable?');
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Text style={styles.title}>Add a child</Text>

      <Text style={styles.label}>School</Text>
      {schools.map((s) => (
        <SelectRow
          key={s.id}
          label={s.name}
          selected={schoolId === s.id}
          onPress={() => {
            setSchoolId(s.id);
            setRouteId(null);
            setStopId(null);
          }}
        />
      ))}

      {schoolId && (
        <>
          <Text style={styles.label}>Route</Text>
          {schoolRoutes.map((r) => (
            <SelectRow
              key={r.id}
              label={r.name}
              selected={routeId === r.id}
              onPress={() => {
                setRouteId(r.id);
                setStopId(null);
              }}
            />
          ))}
        </>
      )}

      {routeId && (
        <>
          <Text style={styles.label}>Pickup stop</Text>
          {stops.map((st) => (
            <SelectRow
              key={st.id}
              label={`${st.name}  ·  ${st.scheduledTime}`}
              selected={stopId === st.id}
              onPress={() => setStopId(st.id)}
            />
          ))}
        </>
      )}

      <Text style={styles.label}>Child</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Full name"
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        value={grade}
        onChangeText={setGrade}
        placeholder="Grade (e.g. Grade 3)"
        editable={!busy}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.cta, !canSubmit && styles.ctaDisabled]}
        onPress={submit}
        disabled={!canSubmit}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.ctaText}>Add child</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function SelectRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.row, selected && styles.rowSelected]} onPress={onPress}>
      <Text style={[styles.rowText, selected && styles.rowTextSelected]}>{label}</Text>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={selected ? colors.primary : colors.border}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.primary },
  rowText: { fontSize: 15, color: colors.text, flex: 1 },
  rowTextSelected: { fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 14 },
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
