import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppProvider } from '@/store/AppContext';
import { colors } from '@/theme/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.onPrimary,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="track/[childId]"
            options={{ title: 'Live tracking', presentation: 'card' }}
          />
          <Stack.Screen
            name="paywall"
            options={{ title: 'Subscription', presentation: 'modal' }}
          />
        </Stack>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
