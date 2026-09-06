import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useToken } from "@/auth";
import { installCrashHandler, recordCrash } from "@/crash";
import { useTheme } from "@/theme";

// Before anything else renders: a fatal JS error gets written down.
installCrashHandler();

/**
 * Rendered by Expo Router in place of the tree when a screen throws. Shows
 * the error rather than a dead app, and keeps a copy for the next launch.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  void recordCrash(error);
  return (
    <ScrollView contentContainerStyle={boundary.wrap}>
      <Text style={boundary.title}>Something broke</Text>
      <Text style={boundary.message} selectable>{error.message}</Text>
      <Text style={boundary.stack} selectable>{(error.stack ?? "").split("\n").slice(0, 15).join("\n")}</Text>
      <Pressable onPress={() => void retry()} style={boundary.button}>
        <Text style={boundary.buttonText}>Try again</Text>
      </Pressable>
    </ScrollView>
  );
}

const boundary = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 80, backgroundColor: "#fbfbfa", minHeight: "100%" },
  title: { fontSize: 20, fontWeight: "700", color: "#a8321f", marginBottom: 10 },
  message: { fontSize: 14, color: "#1c1b19", marginBottom: 12 },
  stack: { fontSize: 10, fontFamily: "Menlo", color: "#6f6b66", marginBottom: 20 },
  button: { alignSelf: "flex-start", backgroundColor: "#1c1b19", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14 },
  buttonText: { color: "#fbfbfa", fontWeight: "600" },
});

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
