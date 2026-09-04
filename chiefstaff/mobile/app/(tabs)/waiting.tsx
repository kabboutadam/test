import { useCallback } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, useFetch, type Loop } from "@/api";
import { Button, Card, Empty, Lede, Screen, Tag, Title } from "@/components/ui";
import { useTheme } from "@/theme";

function LoopCard({ loop, onClosed }: { loop: Loop; onClosed: () => void }) {
  const t = useTheme();
  const overdue = loop.dueAt ? new Date(loop.dueAt).getTime() < Date.now() : loop.daysOpen >= 7;

  const close = async (status: "answered" | "dropped") => {
    await api.closeLoop(loop.id, status);
    onClosed();
  };

  return (
    <Card>
      <View style={styles.meta}>
        <Tag tone={overdue ? "urgent" : "default"}>{loop.daysOpen === 0 ? "today" : `${loop.daysOpen}d`}</Tag>
        <Text style={[styles.metaText, { color: t.muted }]} numberOfLines={1}>
          {loop.person?.name ?? loop.person?.email ?? "unassigned"}
        </Text>
        {loop.dueAt && (
          <Text style={[styles.metaText, { color: overdue ? t.urgent : t.muted }]}>due {loop.dueAt.slice(0, 10)}</Text>
        )}
      </View>
      <Text style={[styles.ask, { color: t.ink }]}>{loop.ask}</Text>
      <View style={styles.actions}>
        <Button onPress={() => void close("answered")}>Answered</Button>
        <Button onPress={() => void close("dropped")}>Drop it</Button>
        {loop.url && (
          <Text style={[styles.link, { color: t.accent }]} onPress={() => void Linking.openURL(loop.url!)}>
            source
          </Text>
        )}
      </View>
    </Card>
  );
}

export default function WaitingScreen() {
  const load = useCallback(() => api.loops(), []);
  const { data, error, loading, refresh } = useFetch(load);
  const loops = (data?.loops ?? []).filter((loop) => loop.direction !== "owed_by_me");
  const mine = (data?.loops ?? []).filter((loop) => loop.direction === "owed_by_me");

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
        >
          <Title>You’re waiting on</Title>
          <Lede>{error ?? "Things you asked for that haven’t come back. Oldest first."}</Lede>
          {loops.map((loop) => (
            <LoopCard key={loop.id} loop={loop} onClosed={() => void refresh()} />
          ))}
          {!loading && loops.length === 0 && !error && <Empty>Nothing outstanding. Everyone has come back to you.</Empty>}
          {mine.length > 0 && (
            <>
              <Title>You owe</Title>
              <Lede>Things you said you’d do.</Lede>
              {mine.map((loop) => (
                <LoopCard key={loop.id} loop={loop} onClosed={() => void refresh()} />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  metaText: { fontSize: 12, flexShrink: 1 },
  ask: { fontSize: 16, fontWeight: "600", letterSpacing: -0.2, marginBottom: 12, lineHeight: 22 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  link: { fontSize: 13, marginLeft: "auto" },
});
