import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { registerForPush } from "@/push";
import { useTheme } from "@/theme";

export default function TabsLayout() {
  const t = useTheme();

  // Every launch: permission is idempotent and the server upserts the token.
  useEffect(() => {
    registerForPush().catch(() => undefined);
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.ink,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.panel, borderTopColor: t.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Brief", tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="inbox"
        options={{ title: "Inbox", tabBarIcon: ({ color, size }) => <Ionicons name="checkbox-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="waiting"
        options={{ title: "Waiting on", tabBarIcon: ({ color, size }) => <Ionicons name="hourglass-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="sales"
        options={{ title: "Sales", tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="decisions"
        options={{ title: "Decisions", tabBarIcon: ({ color, size }) => <Ionicons name="git-branch-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
