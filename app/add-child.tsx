/**
 * Add-child onboarding. Pick a school → a route at that school → the child's
 * stop, then name + grade. Submits through AppContext.addChild, which posts to
 * the backend (guarded /me/children) in backend mode, or appends locally in
 * simulator mode.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routes as allRoutes, schools } from '@/data/mockData';
import { useI18n } from '@/i18n/I18nContext';
import { useApp } from '@/store/AppContext';
import { colors, radius, spacing } from '@/theme/theme';

export default function AddChildScreen() {
  const { addChild, updateChild, removeChild, children } = useApp();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // If a childId is passed, this screen edits that child instead of adding.
  const { childId } = useLocalSearchParams<{ childId?: string }>();
  const editing = children.find((c) => c.id === childId);

  const [schoolId, setSchoolId] = useState<string | null>(
    editing ? (allRoutes.find((r) => r.id === editing.routeId)?.schoolId ?? null) : null,
  );
  const [routeId, setRouteId] = useState<string | null>(editing?.routeId ?? null);
  const [stopId, setStopId] = useState<string | null>(editing?.stopId ?? null);
  const [name, setName] = useState(editing?.name ?? '');
  const [grade, setGrade] = useState(editing?.grade ?? '');
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
      if (editing) {
        await updateChild(editing.id, {
          name: name.trim(),
          grade: grade.trim(),
          routeId,
          stopId,
        });
      } else {
        await addChild({ name: name.trim(), grade: grade.trim(), routeId, stopId });
      }
      router.back();
    } catch {
      setError(t('addChild.saveError'));
      setBusy(false);
    }
  }

  function confirmRemove() {
    if (!editing) return;
    Alert.alert(
      t('addChild.removeChild'),
      t('addChild.removeConfirm', { name: editing.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            await removeChild(editing.id);
            router.back();
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Text style={styles.title}>
        {editing ? t('addChild.editTitle') : t('addChild.addTitle')}
      </Text>

      <Text style={styles.label}>{t('addChild.school')}</Text>
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
          <Text style={styles.label}>{t('addChild.route')}</Text>
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
          <Text style={styles.label}>{t('addChild.pickupStop')}</Text>
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

      <Text style={styles.label}>{t('addChild.child')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('addChild.fullName')}
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        value={grade}
        onChangeText={setGrade}
        placeholder={t('addChild.grade')}
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
          <Text style={styles.ctaText}>
            {editing ? t('common.save') : t('addChild.add')}
          </Text>
        )}
      </Pressable>

      {editing && !busy && (
        <Pressable style={styles.remove} onPress={confirmRemove}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={styles.removeText}>{t('addChild.removeChild')}</Text>
        </Pressable>
      )}
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
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  removeText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
