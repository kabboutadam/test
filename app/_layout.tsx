import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { config } from '@/api/config';
import '@/services/driverLocationTask'; // registers the background-location task
import { I18nProvider, useI18n } from '@/i18n/I18nContext';
import { AppProvider } from '@/store/AppContext';
import { AuthProvider, useAuth } from '@/store/AuthContext';
import { NotificationsProvider } from '@/store/NotificationsContext';
import { colors } from '@/theme/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <AuthProvider>
          <AuthGate>
            <AppProvider>
              <NotificationsProvider>
                <StatusBar style="light" />
                <RootStack />
              </NotificationsProvider>
            </AppProvider>
          </AuthGate>
        </AuthProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}

/**
 * In backend mode, force the login screen until there's a token. In simulator
 * mode this is a pass-through (no login needed).
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, ready, role } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!config.useBackend || !ready) return;
    const onLogin = segments[0] === 'login';
    const inSchool = segments[0] === 'school';
    const inDriver = segments[0] === 'driver';
    if (!token) {
      if (!onLogin) router.replace('/login');
    } else if (role === 'operator') {
      // Schools live in the /school area, not the parent tabs.
      if (!inSchool) router.replace('/school');
    } else if (role === 'driver') {
      // Drivers go straight to the streaming screen.
      if (!inDriver) router.replace('/driver');
    } else if (onLogin || inSchool || inDriver) {
      router.replace('/');
    }
  }, [token, ready, role, segments, router]);

  if (config.useBackend && !ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <>{children}</>;
}

function RootStack() {
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.onPrimary,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="school/index" options={{ headerShown: false }} />
      <Stack.Screen
        name="school/add-child"
        options={{ title: 'Add child', presentation: 'modal' }}
      />
      <Stack.Screen name="school/arrange" options={{ title: 'Pickup order & times' }} />
      <Stack.Screen name="school/add-bus" options={{ title: 'Add bus', presentation: 'modal' }} />
      <Stack.Screen
        name="track/[childId]"
        options={{ title: t('track.title'), presentation: 'card' }}
      />
      <Stack.Screen
        name="driver/index"
        options={{ title: t('account.driverMode') }}
      />
      <Stack.Screen
        name="add-child"
        options={{ title: t('addChild.addTitle'), presentation: 'modal' }}
      />
      <Stack.Screen
        name="paywall"
        options={{ title: t('account.subscription'), presentation: 'modal' }}
      />
    </Stack>
  );
}
