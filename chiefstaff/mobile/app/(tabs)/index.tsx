import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, useFetch, type Movement } from "@/api";
import { Blocks } from "@/components/Blocks";
import { Button, Card, Empty, Lede, Screen, Tag, Title } from "@/components/ui";
import { useTheme } from "@/theme";

function MovementCard({ movement, onMarked }: { movement: Movement; onMarked: () => void }) {
  const t = useTheme();
  const mark = async (status: "useful" | "not_useful") => {
    await api.markMovement(movement.id, status);
    onMarked();
  };
  return (
    <Card>
      <View style={styles.meta}>
        <Tag tone={Math.abs(movement.deviation) >= 3 ? "urgent" : "warm"}>
          {movement.deviation > 0 ? "up" : "down"} {Math.abs(movement.deviation).toFixed(1)}σ
        </Tag>
        {movement.owner && <Text style={[styles.metaText, { color: t.muted }]}>{movement.owner.name ?? movement.owner.email}</Text>}
      </View>
      <Text style={[styles.sentence, { color: t.ink }]}>{movement.sentence}</Text>
      <View style={styles.actions}>
        <Button onPress={() => void mark("useful")}>Useful</Button>
        <Button onPress={() => void mark("not_useful")}>Not useful</Button>
      </View>
    </Card>
  );
}

export default function BriefScreen() {
  const router = useRouter();
  const t = useTheme();
  const load = useCallback(async () => {
    const [brief, movements, preps] = await Promise.all([
      api.brief(),
      api.movements().catch(() => ({ movements: [] })),
      api.preps().catch(() => ({ preps: [] })),
    ]);
    return { brief: brief.brief, movements: movements.movements, preps: preps.preps };
  }, []);
  const { data, error, loading, refresh } = useFetch(load);
  const brief = data?.brief;
  const movements = data?.movements ?? [];
  const preps = data?.preps ?? [];

  const dateLabel = brief
    ? new Date(`${brief.forDate}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    : null;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
        >
          <Title>Your brief</Title>
          <Lede>{dateLabel ?? (error ?? "No brief yet.")}</Lede>

          {brief ? <Blocks blocks={brief.blocks} /> : !loading && <Empty>Your first brief arrives at your brief hour once a source is connected on the web.</Empty>}

          {movements.length > 0 && (
            <>
              <Text style={[styles.section, { color: t.accent }]}>WHAT MOVED</Text>
              {movements.map((movement) => (
                <MovementCard key={movement.id} movement={movement} onMarked={() => void refresh()} />
              ))}
            </>
          )}

          {preps.length > 0 && (
            <>
              <Text style={[styles.section, { color: t.accent }]}>PREP READY</Text>
              {preps.map((prep) => (
                <Pressable key={prep.id} onPress={() => router.push({ pathname: "/prep/[id]", params: { id: prep.id } })}>
                  <Card>
                    <View style={styles.meta}>
                      <Text style={[styles.metaText, { color: t.muted }]}>
                        {new Date(prep.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                      {prep.person && <Text style={[styles.metaText, { color: t.muted }]}>{prep.person.name ?? prep.person.email}</Text>}
                    </View>
                    <Text style={[styles.sentence, { color: t.ink }]}>{prep.title}</Text>
                    <Text style={[styles.metaText, { color: t.accent, marginTop: 6 }]}>open prep →</Text>
                  </Card>
                </Pressable>
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
  section: { fontSize: 12.5, fontWeight: "700", letterSpacing: 1, marginTop: 26, marginBottom: 10 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  metaText: { fontSize: 12 },
  sentence: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
  actions: { flexDirection: "row", gap: 8 },
});
