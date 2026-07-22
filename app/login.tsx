/**
 * Phone-OTP login. Shown only in backend mode (config.useBackend) when there's
 * no stored token — see app/_layout.tsx gating. Two steps: enter phone, then
 * enter the code. In the demo the server returns the code, so we prefill it.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { useAuth } from '@/store/AuthContext';
import { colors, radius, spacing } from '@/theme/theme';

const DEMO_PHONE = '+961 3 555 777';

export default function LoginScreen() {
  const { requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState(DEMO_PHONE);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const { devCode } = await requestOtp(phone);
      if (devCode) setCode(devCode); // demo convenience
      setStep('code');
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(phone, code.trim());
      // On success the root layout swaps to the app automatically.
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.logo}>
        <Ionicons name="bus" size={40} color={colors.onPrimary} />
      </View>
      <Text style={styles.title}>BusMapp</Text>
      <Text style={styles.subtitle}>
        {step === 'phone'
          ? 'Sign in with your phone number'
          : `Enter the code sent to ${phone}`}
      </Text>

      {step === 'phone' ? (
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+961 …"
          keyboardType="phone-pad"
          autoFocus
          editable={!busy}
        />
      ) : (
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="6-digit code"
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          editable={!busy}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.cta, busy && styles.ctaDisabled]}
        onPress={step === 'phone' ? sendCode : submitCode}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.ctaText}>
            {step === 'phone' ? 'Send code' : 'Verify'}
          </Text>
        )}
      </Pressable>

      {step === 'code' && !busy && (
        <Pressable onPress={() => setStep('phone')}>
          <Text style={styles.link}>Use a different number</Text>
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
}

function describe(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Invalid or expired code.';
    return `Something went wrong (${e.status}).`;
  }
  return 'Network error — is the server running?';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 30, fontWeight: '800', color: colors.text },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  input: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
  },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  cta: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
});
