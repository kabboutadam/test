import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, useFetch } from "@/api";
import { Lede, Screen, Title } from "@/components/ui";
import { useTheme } from "@/theme";

export default function PrepScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const load = useCallback(() => api.preps().then((result) => result.preps.find((prep) => prep.id === id) ?? null), [id]);
  const { data: prep, error } = useFetch(load);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Prep", headerStyle: { backgroundColor: t.panel }, headerTintColor: t.ink }} />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Title>{prep?.title ?? "Prep"}</Title>
          <Lede>
            {error ??
              (prep
                ? `${new Date(prep.startsAt).toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit" })}${prep.person ? ` · with ${prep.person.name ?? prep.person.email}` : ""}`
                : "Loading…")}
          </Lede>
          {prep?.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={[styles.heading, { color: t.accent }]}>{section.heading.toUpperCase()}</Text>
              {section.lines.map((line, index) => (
                <View key={index} style={styles.line}>
                  <Text style={[styles.bullet, { color: t.muted }]}>•</Text>
                  <Text style={[styles.text, { color: t.ink }]}>{line}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 18 },
  heading: { fontSize: 12.5, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  line: { flexDirection: "row", gap: 8, marginBottom: 6 },
  bullet: { fontSize: 16, lineHeight: 23 },
  text: { fontSize: 15.5, lineHeight: 23, flex: 1 },
});
