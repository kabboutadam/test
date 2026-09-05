import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { useToken } from "@/auth";
import { useTheme } from "@/theme";

/**
 * Auth gate. The navigator is always rendered once the token has loaded;
 * which screens exist is decided by guards, not by navigating. Returning a
 * <Redirect> here instead of the <Stack> is a crash in a release build —
 * Expo Router throws for navigating before the root layout has mounted.
 */
export default function RootLayout() {
  const token = useToken();
  const t = useTheme();

  if (token === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator color={t.muted} />
      </View>
    );
  }

  const signedIn = Boolean(token);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="prep/[id]" options={{ headerShown: true, title: "Prep" }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="link" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
