/**
 * School operator: create a route with just a name. The school is automatically
 * the destination; each child added later drops a pin that becomes a pickup
 * stop. Deliberately one field — schools should not have to think about maps or
 * coordinates to get started.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
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

export default function SchoolAddRoute() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!token || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminCreateRoute(token, name.trim());
      router.back();
    } catch {
      setError('Could not create the route. Please try again.');
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'New route' }} />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="git-branch" size={24} color={colors.onPrimary} />
        </View>
        <Text style={styles.heroTitle}>Name your route</Text>
        <Text style={styles.heroSub}>
          That's all we need. Your school is the destination — add kids next and
          drop a pin for each home. The bus route builds itself.
        </Text>
      </View>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Morning Bus 1 — Hamra"
        editable={!busy}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={create}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.cta, (!name.trim() || busy) && styles.ctaDisabled]}
        onPress={create}
        disabled={!name.trim() || busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.ctaText}>Create route</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  heroSub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.md,
  },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.sm },
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
