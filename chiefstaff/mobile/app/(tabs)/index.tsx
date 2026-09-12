import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, useFetch, type Decision, type Movement, type SalesView } from "@/api";
import { Avatar } from "@/components/Avatar";
import { Blocks } from "@/components/Blocks";
import { MonthlyBars } from "@/components/MonthlyBars";
import { Reading } from "@/components/Reading";
import { Sparkline } from "@/components/Sparkline";
import { Button, Card, Empty, Section, Screen, StatTile, Tag } from "@/components/ui";
import { money, pct } from "@/format";
import { useTheme } from "@/theme";

const URGENCY = ["whenever", "this week", "today", "now"];

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

function clock(iso: string, timezone: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  } catch {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
}

/** A decision, compact: who, what, why, and the two answers that close most of them. */
function DecisionMini({ decision, onResolved }: { decision: Decision; onResolved: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const resolve = async (status: "approved" | "dismissed") => {
    setBusy(true);
    try {
      await api.resolveDecision(decision.id, status);
      onResolved();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card stripe={decision.urgency === 3 ? t.urgent : decision.urgency === 2 ? t.accent : undefined}>
      <View style={styles.row}>
        {decision.person && <Avatar name={decision.person.name} email={decision.person.email} size={32} />}
        <View style={{ flex: 1 }}>
          <View style={styles.tags}>
            <Tag tone={decision.urgency === 3 ? "urgent" : decision.urgency === 2 ? "warm" : "default"}>{URGENCY[decision.urgency]}</Tag>
            <Tag>{decision.category}</Tag>
            {decision.person && (
              <Text style={[styles.metaText, { color: t.muted }]} numberOfLines={1}>
                {decision.person.name ?? decision.person.email}
              </Text>
            )}
          </View>
          <Text style={[styles.title, { color: t.ink }]}>{decision.title}</Text>
          <Text style={[styles.why, { color: t.muted }]} numberOfLines={2}>
            {decision.why}
          </Text>
          <View style={styles.actions}>
            <Button primary disabled={busy} onPress={() => void resolve("approved")}>
              {decision.draft ? "Approve draft" : "Got it"}
            </Button>
            <Button disabled={busy} onPress={() => void resolve("dismissed")}>
              Not mine
            </Button>
            <Text style={[styles.link, { color: t.accent }]} onPress={() => router.push("/inbox")}>
              draft →
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
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
      <View style={styles.tags}>
        <Tag tone={big ? "urgent" : "warm"}>
          {movement.deviation > 0 ? "up" : "down"} {Math.abs(movement.deviation).toFixed(1)}σ
        </Tag>
        {movement.owner && (
          <View style={styles.owner}>
            <Avatar name={movement.owner.name} email={movement.owner.email} size={20} />
            <Text style={[styles.metaText, { color: t.muted }]} numberOfLines={1}>
              {movement.owner.name ?? movement.owner.email}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.sentence, { color: t.ink }]}>{movement.sentence}</Text>
      {movement.series && movement.series.values.length >= 3 && (
        <View style={{ alignItems: "flex-end", marginBottom: 6 }}>
          <Sparkline series={movement.series} width={200} height={52} />
        </View>
      )}
      <View style={styles.actions}>
        <Button onPress={() => void mark("useful")}>Useful</Button>
        <Button onPress={() => void mark("not_useful")}>Not useful</Button>
      </View>
    </Card>
  );
}

function SalesPulse({ sales, width }: { sales: SalesView; width: number }) {
  const t = useTheme();
  const router = useRouter();
  const last = sales.months.filter((point) => !point.partial).at(-1);
  if (!last) return null;
  const gap = last.target ? last.actual / last.target - 1 : null;
  const watch = sales.readings.find((reading) => reading.tone === "bad");
  const coverage = sales.pipeline?.coverage ?? null;
  return (
    <Card>
      <View style={styles.pulse}>
        <View>
          <Text style={[styles.pulseValue, { color: gap === null ? t.ink : gap < -0.02 ? t.bad : gap >= 0 ? t.good : t.ink }]}>{gap === null ? money(last.actual, sales.currency) : pct(gap, 1)}</Text>
          <Text style={[styles.pulseLabel, { color: t.muted }]}>last month vs target</Text>
        </View>
        {sales.mtd && (
          <View>
            <Text style={[styles.pulseValue, { color: t.ink }]}>{money(sales.mtd.pace, sales.currency)}</Text>
            <Text style={[styles.pulseLabel, { color: t.muted }]}>pacing this month</Text>
          </View>
        )}
        {coverage !== null && (
          <View>
            <Text style={[styles.pulseValue, { color: coverage < 1 ? t.bad : t.ink }]}>{coverage.toFixed(1)}×</Text>
            <Text style={[styles.pulseLabel, { color: t.muted }]}>pipeline</Text>
          </View>
        )}
      </View>
      <MonthlyBars months={sales.months.slice(-6)} currency={sales.currency} width={width} height={130} />
      {watch && <Reading reading={watch} />}
      <Text style={[styles.link, { color: t.accent, marginTop: 10 }]} onPress={() => router.push("/sales")}>
        full sales page →
      </Text>
    </Card>
  );
}

export default function BriefScreen() {
  const router = useRouter();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [showWritten, setShowWritten] = useState(false);
  const load = useCallback(async () => {
    const [brief, inbox, movements, sales] = await Promise.all([
      api.brief(),
      api.decisions().catch(() => ({ decisions: [] as Decision[] })),
      api.movements().catch(() => ({ movements: [] as Movement[] })),
      api.sales().catch(() => ({ sales: null as SalesView | null })),
    ]);
    return { ...brief, decisions: inbox.decisions.slice(0, 3), movements: movements.movements, sales: sales.sales };
  }, []);
  const { data, error, loading, refresh } = useFetch(load);
  const brief = data?.brief;
  const stats = data?.stats;
  const meetings = data?.meetings ?? [];
  const movements = data?.movements ?? [];
  const decisions = data?.decisions ?? [];
  const talkTo = data?.talkTo ?? [];
  const waiting = data?.waiting ?? [];
  const reviews = data?.reviews ?? [];
  const sales = data?.sales ?? null;

  const timezone = data?.greeting.timezone ?? "UTC";
  const firstName = data?.greeting.name?.split(" ")[0];
  const dateLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: timezone });
  const heading = firstName ? `${greetingFor(localHour(timezone))}, ${firstName}.` : "Your brief";
  const lastMonth = sales?.months.filter((point) => !point.partial).at(-1);
  const lastGap = lastMonth?.target ? lastMonth.actual / lastMonth.target - 1 : null;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
          <Text style={[styles.eyebrow, { color: t.muted }]}>{dateLabel}</Text>
          <Text style={[styles.hero, { color: t.ink }]}>{heading}</Text>
          {data?.dayLine && <Text style={[styles.dayLine, { color: t.muted }]}>{data.dayLine}</Text>}
          {error && <Text style={[styles.error, { color: t.urgent }]}>{error}</Text>}

          {stats && (
            <View style={styles.stats}>
              <StatTile value={stats.needsYou} label="need you" note={stats.urgent ? `${stats.urgent} today` : "nothing urgent"} tone={stats.urgent ? "bad" : undefined} onPress={() => router.push("/inbox")} />
              <StatTile value={stats.moved} label="moved" note={stats.moved ? "outside normal range" : "all within range"} tone={stats.moved ? "bad" : "good"} />
              <StatTile value={stats.waiting} label="waiting on" note={stats.owed ? `and you owe ${stats.owed}` : "what others owe you"} onPress={() => router.push("/waiting")} />
              {lastMonth && sales ? (
                <StatTile value={lastGap === null ? money(lastMonth.actual, sales.currency) : pct(lastGap, 1)} label="sales vs target" note={`${money(lastMonth.actual, sales.currency)} last month`} tone={lastGap === null ? undefined : lastGap < -0.02 ? "bad" : lastGap >= 0 ? "good" : undefined} onPress={() => router.push("/sales")} />
              ) : (
                <StatTile value={stats.meetings} label="meetings today" note={`${stats.prepared} with prep`} />
              )}
            </View>
          )}

          <Section>Needs you today</Section>
          {decisions.map((decision) => (
            <DecisionMini key={decision.id} decision={decision} onResolved={() => void refresh()} />
          ))}
          {!loading && decisions.length === 0 && <Empty>Nothing is waiting on you.</Empty>}
          {stats && stats.needsYou > decisions.length && (
            <Text style={[styles.link, { color: t.accent, marginTop: -4 }]} onPress={() => router.push("/inbox")}>
              All {stats.needsYou} in the inbox →
            </Text>
          )}

          {movements.length > 0 && (
            <>
              <Section>What moved</Section>
              {movements.map((movement) => (
                <MovementCard key={movement.id} movement={movement} onMarked={() => void refresh()} />
              ))}
            </>
          )}

          {sales && lastMonth && (
            <>
              <Section>Sales pulse</Section>
              <SalesPulse sales={sales} width={Math.max(240, width - 72)} />
            </>
          )}

          <Section>Today</Section>
          <Card>
            {meetings.length === 0 && <Text style={[styles.metaText, { color: t.muted }]}>No meetings in the next 24 hours.</Text>}
            {meetings.map((meeting, index) => {
              const row = (
                <View style={[styles.meeting, index > 0 && { borderTopWidth: 1, borderTopColor: t.line }]}>
                  <Text style={[styles.time, { color: t.muted }]}>
                    {meeting.tomorrow ? "tmrw " : ""}
                    {clock(meeting.startsAt, timezone)}
                  </Text>
                  <View style={[styles.dot, { backgroundColor: meeting.prepId ? t.accent : t.band, borderColor: meeting.prepId ? t.accent : t.line }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.meetingTitle, { color: t.ink }]} numberOfLines={2}>
                      {meeting.title}
                    </Text>
                    {meeting.prepId && <Text style={[styles.link, { color: t.accent }]}>prep ready →</Text>}
                  </View>
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

          {talkTo.length > 0 && (
            <>
              <Section>Who to talk to</Section>
              <Card>
                {talkTo.map((person, index) => (
                  <View key={person.email} style={[styles.person, index > 0 && { borderTopWidth: 1, borderTopColor: t.line }]}>
                    <Avatar name={person.name} email={person.email} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.meetingTitle, { color: t.ink }]}>{person.name}</Text>
                      <Text style={[styles.metaText, { color: t.muted }]}>{person.reasons.join("; ")}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}

          <Section>Waiting on</Section>
          <Card>
            {waiting.length === 0 && <Text style={[styles.metaText, { color: t.muted }]}>Everyone has come back to you.</Text>}
            {waiting.map((loop, index) => (
              <View key={loop.id} style={[styles.person, index > 0 && { borderTopWidth: 1, borderTopColor: t.line }]}>
                <Avatar name={loop.person?.name} email={loop.person?.email} size={26} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.loopAsk, { color: t.ink }]} numberOfLines={1}>
                    {loop.ask}
                  </Text>
                  <Text style={[styles.metaText, { color: t.muted }]}>{loop.person?.name ?? loop.person?.email ?? "unassigned"}</Text>
                </View>
                <Tag tone={loop.overdue ? "urgent" : "default"}>{loop.daysOpen}d</Tag>
              </View>
            ))}
            {stats && (stats.waiting > waiting.length || stats.owed > 0) && (
              <Text style={[styles.link, { color: t.accent, marginTop: 10 }]} onPress={() => router.push("/waiting")}>
                {stats.waiting > waiting.length ? `All ${stats.waiting} →` : "Open the list →"}
                {stats.owed ? ` · you owe ${stats.owed}` : ""}
              </Text>
            )}
          </Card>

          {reviews.length > 0 && (
            <>
              <Section>Decisions due for review</Section>
              <Card>
                {reviews.map((record, index) => (
                  <Pressable key={record.id} onPress={() => router.push("/decisions")} style={[styles.person, index > 0 && { borderTopWidth: 1, borderTopColor: t.line }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.loopAsk, { color: t.ink }]} numberOfLines={1}>
                        {record.title}
                      </Text>
                      <Text style={[styles.metaText, { color: t.muted }]} numberOfLines={2}>
                        expected: {record.expected}
                      </Text>
                    </View>
                    <Text style={[styles.link, { color: t.accent }]}>close →</Text>
                  </Pressable>
                ))}
              </Card>
            </>
          )}

          {brief && (
            <View style={[styles.written, { borderTopColor: t.line }]}>
              <Pressable onPress={() => setShowWritten((value) => !value)}>
                <Text style={[styles.writtenTitle, { color: t.ink }]}>
                  {showWritten ? "▾" : "▸"} The written brief
                </Text>
                <Text style={[styles.metaText, { color: t.muted }]}>the narrative version, section by section</Text>
              </Pressable>
              {showWritten && (
                <View style={{ marginTop: 8 }}>
                  <Blocks blocks={brief.blocks} />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 12.5, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  hero: { fontSize: 30, fontWeight: "700", letterSpacing: -0.8, lineHeight: 36, marginBottom: 6 },
  dayLine: { fontSize: 15, lineHeight: 21, marginBottom: 16 },
  error: { fontSize: 14, marginBottom: 12 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  tags: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 },
  metaText: { fontSize: 12, flexShrink: 1 },
  title: { fontSize: 15.5, fontWeight: "600", letterSpacing: -0.2, marginBottom: 3 },
  why: { fontSize: 13.5, lineHeight: 19, marginBottom: 10 },
  sentence: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  owner: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  link: { fontSize: 13, fontWeight: "600" },
  pulse: { flexDirection: "row", gap: 22, flexWrap: "wrap", marginBottom: 8 },
  pulseValue: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  pulseLabel: { fontSize: 11.5, marginTop: 1 },
  meeting: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
  time: { fontSize: 12, fontVariant: ["tabular-nums"], width: 68, paddingTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: 5 },
  meetingTitle: { fontSize: 14.5, fontWeight: "600" },
  person: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  loopAsk: { fontSize: 13.5, fontWeight: "600" },
  written: { marginTop: 28, borderTopWidth: 1, paddingTop: 16 },
  writtenTitle: { fontSize: 14.5, fontWeight: "600", marginBottom: 2 },
});
