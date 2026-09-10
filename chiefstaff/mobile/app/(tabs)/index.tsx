import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, useFetch, type Movement } from "@/api";
import { Avatar } from "@/components/Avatar";
import { Blocks } from "@/components/Blocks";
import { Sparkline } from "@/components/Sparkline";
import { Button, Card, Empty, Section, Screen, StatTile, Tag } from "@/components/ui";
import { useTheme } from "@/theme";

function greetingFor(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function localHour(timezone: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone }).format(new Date()));
  } catch {
    return new Date().getHours();
  }
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function MovementCard({ movement, onMarked }: { movement: Movement; onMarked: () => void }) {
  const t = useTheme();
  const big = Math.abs(movement.deviation) >= 3;
  const mark = async (status: "useful" | "not_useful") => {
    await api.markMovement(movement.id, status);
    onMarked();
  };
  return (
    <Card stripe={big ? t.urgent : t.accent}>
      <View style={styles.movement}>
        <View style={{ flex: 1 }}>
          <View style={styles.meta}>
            <Tag tone={big ? "urgent" : "warm"}>
              {movement.deviation > 0 ? "up" : "down"} {Math.abs(movement.deviation).toFixed(1)}σ
            </Tag>
            <Text style={[styles.metaText, { color: t.muted }]} numberOfLines={1}>
              {movement.metric}
              {movement.segment ? ` · ${movement.segment}` : ""}
            </Text>
          </View>
          <Text style={[styles.sentence, { color: t.ink }]}>{movement.sentence}</Text>
        </View>
        {movement.series && movement.series.values.length >= 3 && (
          <View style={styles.spark}>
            <Sparkline series={movement.series} width={120} height={56} />
            <Text style={[styles.sparkNote, { color: t.faint }]}>last {movement.series.values.length} periods, band = normal</Text>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {movement.owner && (
          <View style={styles.owner}>
            <Avatar name={movement.owner.name} email={movement.owner.email} size={24} />
            <Text style={[styles.metaText, { color: t.muted }]} numberOfLines={1}>
              {(movement.owner.name ?? movement.owner.email).split(" ")[0]} owns it
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
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
      api.movements().catch(() => ({ movements: [] as Movement[] })),
      api.preps().catch(() => ({ preps: [] })),
    ]);
    return { ...brief, movements: movements.movements, preps: preps.preps };
  }, []);
  const { data, error, loading, refresh } = useFetch(load);
  const brief = data?.brief;
  const stats = data?.stats;
  const meetings = data?.meetings ?? [];
  const movements = data?.movements ?? [];
  const preps = data?.preps ?? [];
  const prepPerson = new Map(preps.map((prep) => [prep.id, prep.person]));

  const timezone = data?.greeting.timezone ?? "UTC";
  const firstName = data?.greeting.name?.split(" ")[0];
  const dateLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: timezone });
  const heading = firstName ? `${greetingFor(localHour(timezone))}, ${firstName}.` : "Your brief";

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
        >
          <Text style={[styles.eyebrow, { color: t.muted }]}>{dateLabel}</Text>
          <Text style={[styles.hero, { color: t.ink }]}>{heading}</Text>
          {error && <Text style={[styles.error, { color: t.urgent }]}>{error}</Text>}

          {stats && (
            <View style={styles.stats}>
              <StatTile
                value={stats.needsYou}
                label="need you"
                note={stats.urgent ? `${stats.urgent} today` : "nothing urgent"}
                tone={stats.urgent ? "bad" : undefined}
                onPress={() => router.push("/inbox")}
              />
              <StatTile
                value={stats.moved}
                label="moved"
                note={stats.moved ? "outside normal range" : "all within range"}
                tone={stats.moved ? "bad" : "good"}
              />
              <StatTile value={stats.waiting} label="waiting on" note="what others owe you" onPress={() => router.push("/waiting")} />
              <StatTile value={stats.meetings} label="meetings today" note={`${stats.prepared} with prep`} />
            </View>
          )}

          {brief ? (
            <Blocks blocks={brief.blocks} />
          ) : (
            !loading && !error && <Empty>Your first brief arrives at your brief hour once a source is connected on the web.</Empty>
          )}

          {movements.length > 0 && (
            <>
              <Section>What moved</Section>
              {movements.map((movement) => (
                <MovementCard key={movement.id} movement={movement} onMarked={() => void refresh()} />
              ))}
            </>
          )}

          {meetings.length > 0 && (
            <>
              <Section>Today</Section>
              <Card>
                {meetings.map((meeting, index) => {
                  const person = meeting.prepId ? prepPerson.get(meeting.prepId) : null;
                  const row = (
                    <View style={[styles.meeting, index > 0 && { borderTopWidth: 1, borderTopColor: t.line }]}>
                      <Text style={[styles.time, { color: t.muted }]}>{clock(meeting.startsAt)}</Text>
                      {person ? <Avatar name={person.name} email={person.email} size={28} /> : <View style={[styles.dot, { backgroundColor: t.band }]} />}
                      <Text style={[styles.meetingTitle, { color: t.ink }]} numberOfLines={2}>
                        {meeting.title}
                      </Text>
                      {meeting.prepId && <Text style={[styles.link, { color: t.accent }]}>prep →</Text>}
                    </View>
                  );
                  return meeting.prepId ? (
                    <Pressable key={meeting.id} onPress={() => router.push({ pathname: "/prep/[id]", params: { id: meeting.prepId! } })}>
                      {row}
                    </Pressable>
                  ) : (
                    <View key={meeting.id}>{row}</View>
                  );
                })}
              </Card>
            </>
          )}

          {preps.length > 0 && meetings.every((meeting) => !meeting.prepId) && (
            <>
              <Section>Prep ready</Section>
              {preps.map((prep) => (
                <Pressable key={prep.id} onPress={() => router.push({ pathname: "/prep/[id]", params: { id: prep.id } })}>
                  <Card>
                    <View style={styles.meta}>
                      {prep.person && <Avatar name={prep.person.name} email={prep.person.email} size={28} />}
                      <Text style={[styles.metaText, { color: t.muted }]}>{clock(prep.startsAt)}</Text>
                      {prep.person && <Text style={[styles.metaText, { color: t.muted }]}>{prep.person.name ?? prep.person.email}</Text>}
                    </View>
                    <Text style={[styles.sentence, { color: t.ink }]}>{prep.title}</Text>
                    <Text style={[styles.link, { color: t.accent, marginTop: 6 }]}>open prep →</Text>
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
  eyebrow: { fontSize: 12.5, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  hero: { fontSize: 30, fontWeight: "700", letterSpacing: -0.8, lineHeight: 36, marginBottom: 16 },
  error: { fontSize: 14, marginBottom: 12 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  movement: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  spark: { alignItems: "flex-end" },
  sparkNote: { fontSize: 10, marginTop: 2, textAlign: "right", maxWidth: 120 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  metaText: { fontSize: 12, flexShrink: 1 },
  sentence: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  owner: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  meeting: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  time: { fontSize: 12, fontVariant: ["tabular-nums"], width: 40 },
  dot: { width: 28, height: 28, borderRadius: 14 },
  meetingTitle: { flex: 1, fontSize: 14.5, fontWeight: "600" },
  link: { fontSize: 13, fontWeight: "600" },
});
