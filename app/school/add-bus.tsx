/**
 * Add a bus / pickup list. A school can run several buses — each is its own
 * ordered list of kids with its own pickup times. Just needs a name; the school
 * is auto-set as the destination and kids' home pins fill in the stops.
 */

import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as api from '@/api/client';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme/theme';

export default function AddBus() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!token || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminCreateRoute(token, name.trim());
      router.back();
    } catch {
      setError('Could not add the bus — try again.');
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + spacing.lg }]}>
      <Stack.Screen options={{ title: 'Add bus' }} />
      <Text style={styles.intro}>
        Give the bus a name your staff will recognise — e.g. “Bus 1”, “Achrafieh
        run”, or a driver's name. You'll add kids and arrange their order next.
      </Text>
      <Text style={styles.label}>Bus name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Bus 1"
        autoFocus
        editable={!busy}
        onSubmitEditing={submit}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={[styles.cta, (!name.trim() || busy) && styles.ctaDisabled]}
        onPress={submit}
        disabled={!name.trim() || busy}
      >
        {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.ctaText}>Add bus</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  intro: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, marginTop: spacing.md },
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
