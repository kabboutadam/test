import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { useToken } from "@/auth";
import { useTheme } from "@/theme";

/** Auth gate: no token → the link screen; token → the tabs. */
export default function RootLayout() {
  const token = useToken();
  const segments = useSegments();
  const t = useTheme();
  const onLinkScreen = segments[0] === "link";

  if (token === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator color={t.muted} />
      </View>
    );
  }
  if (!token && !onLinkScreen) return <Redirect href="/link" />;
  if (token && onLinkScreen) return <Redirect href="/" />;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="link" />
        <Stack.Screen name="prep/[id]" options={{ headerShown: true, title: "Prep" }} />
      </Stack>
    </>
  );
}
