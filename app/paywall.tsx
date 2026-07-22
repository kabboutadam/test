import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { plans, Plan, statusLabel } from '@/services/subscription';
import { useApp } from '@/store/AppContext';
import { colors, radius, spacing } from '@/theme/theme';

const FEATURES = [
  'Live bus location, updated every second',
  'See exactly how many stops away the bus is',
  'ETA to your child’s stop',
  'Covers every child in your family',
];

export default function PaywallScreen() {
  const { subscription, subscribe } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Plan['id']>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubscribe() {
    setBusy(true);
    setError(null);
    try {
      await subscribe(selected);
      router.back();
    } catch {
      setError('Payment could not be completed. Please try again.');
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <Text style={styles.title}>Track every ride</Text>
      <Text style={styles.subtitle}>Current status: {statusLabel(subscription)}</Text>

      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {plans.map((plan) => {
        const isSelected = selected === plan.id;
        return (
          <Pressable
            key={plan.id}
            style={[styles.plan, isSelected && styles.planSelected]}
            onPress={() => setSelected(plan.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.planLabel}>{plan.label}</Text>
              <Text style={styles.planNote}>{plan.perChildNote}</Text>
            </View>
            <View style={styles.planPriceWrap}>
              <Text style={styles.planPrice}>${plan.priceUsd}</Text>
              <Text style={styles.planCadence}>{plan.cadence}</Text>
            </View>
            <Ionicons
              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={isSelected ? colors.primary : colors.border}
            />
          </Pressable>
        );
      })}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.cta, busy && styles.ctaDisabled]}
        onPress={onSubscribe}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.ctaText}>
            Subscribe {selected === 'yearly' ? 'yearly' : 'monthly'}
          </Text>
        )}
      </Pressable>

      <Text style={styles.disclaimer}>
        Demo only — the mock payment provider is used. Swap in a real gateway
        (Stripe or a Lebanese provider) before release (see docs/PLAN.md).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted },
  features: {
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { fontSize: 15, color: colors.text, flex: 1 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  planSelected: { borderColor: colors.primary },
  planLabel: { fontSize: 17, fontWeight: '700', color: colors.text },
  planNote: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  planPriceWrap: { alignItems: 'flex-end' },
  planPrice: { fontSize: 20, fontWeight: '800', color: colors.text },
  planCadence: { fontSize: 12, color: colors.textMuted },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ctaText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  ctaDisabled: { opacity: 0.6 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
