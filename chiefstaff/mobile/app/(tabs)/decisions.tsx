import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, useFetch, type DecisionRecord } from "@/api";
import { Avatar } from "@/components/Avatar";
import { Button, Card, Empty, Lede, RateBar, Screen, Section, Tag, Title } from "@/components/ui";
import { useTheme } from "@/theme";

function RecordCard({ record, onChanged }: { record: DecisionRecord; onChanged: () => void }) {
  const t = useTheme();
  const [outcome, setOutcome] = useState("");
  const close = async (status: "hit" | "miss" | "mixed") => {
    await api.recordOutcome(record.id, status, outcome);
    onChanged();
  };
  const open = record.status === "open";
  const stripe = record.status === "miss" ? t.bad : record.status === "hit" ? t.good : record.reviewRequested ? t.accent : undefined;
  return (
    <Card stripe={stripe}>
      <View style={styles.meta}>
        {record.owner && <Avatar name={record.owner.name} email={record.owner.email} size={28} />}
        <Tag tone={record.status === "miss" ? "urgent" : record.status === "hit" ? "good" : record.status === "open" ? "default" : "warm"}>
          {open ? record.category : record.status}
        </Tag>
        <Text style={[styles.metaText, { color: record.reviewRequested ? t.accent : t.muted }]}>
          {open ? (record.reviewRequested ? "review due" : `review ${record.reviewAt.slice(0, 10)}`) : "closed"}
        </Text>
      </View>
      <Text style={[styles.title, { color: t.ink }]}>{record.title}</Text>
      <Text style={[styles.why, { color: t.muted }]}>Expected: {record.expected}</Text>
      {record.outcome && <Text style={[styles.why, { color: t.ink }]}>Actual: {record.outcome}</Text>}
      {open && (
        <>
          <TextInput
            value={outcome}
            onChangeText={setOutcome}
            placeholder="What actually happened"
            placeholderTextColor={t.muted}
            style={[styles.input, { color: t.ink, borderColor: t.line, backgroundColor: t.bg }]}
          />
          <View style={styles.actions}>
            <Button primary onPress={() => void close("hit")}>Hit</Button>
            <Button onPress={() => void close("mixed")}>Mixed</Button>
            <Button onPress={() => void close("miss")}>Miss</Button>
          </View>
        </>
      )}
    </Card>
  );
}

export default function DecisionsScreen() {
  const t = useTheme();
  const load = useCallback(() => api.decisionLog(), []);
  const { data, error, loading, refresh } = useFetch(load);
  const records = data?.records ?? [];
  const rates = data?.rates;

  const [title, setTitle] = useState("");
  const [expected, setExpected] = useState("");
  const [saving, setSaving] = useState(false);

  const log = async () => {
    setSaving(true);
    try {
      await api.logDecision({ title, expected, reviewDays: 60 });
      setTitle("");
      setExpected("");
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
          <Title>Decision log</Title>
          <Lede>{error ?? "Decisions with the expectation behind them. The loop closes on the review date."}</Lede>

          <Card>
            <TextInput value={title} onChangeText={setTitle} placeholder="What was decided" placeholderTextColor={t.muted} style={[styles.input, { color: t.ink, borderColor: t.line, backgroundColor: t.bg }]} />
            <TextInput value={expected} onChangeText={setExpected} placeholder="Expected outcome, measurable if possible" placeholderTextColor={t.muted} style={[styles.input, { color: t.ink, borderColor: t.line, backgroundColor: t.bg }]} />
            <Button primary disabled={saving || !title.trim() || !expected.trim()} onPress={() => void log()}>Log it — review in 60 days</Button>
          </Card>

          {rates && rates.closed > 0 && (
            <>
              <Section>Hit rate</Section>
              <Card>
                <Text style={[styles.rates, { color: t.muted }]}>
                  {rates.closed} closed. Share of decisions whose expectation came true, by category.
                </Text>
                {rates.byCategory.map((row) => (
                  <RateBar key={row.name} rate={row.rate} label={row.name} detail={`${row.hit} hit · ${row.mixed} mixed · ${row.miss} miss`} />
                ))}
              </Card>
            </>
          )}

          <Section>Decisions</Section>

          {records.map((record) => (
            <RecordCard key={record.id} record={record} onChanged={() => void refresh()} />
          ))}
          {!loading && records.length === 0 && !error && <Empty>Nothing logged yet. The first one takes a minute.</Empty>}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  metaText: { fontSize: 12 },
  title: { fontSize: 16, fontWeight: "600", letterSpacing: -0.2, marginBottom: 4 },
  why: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  input: { fontSize: 14, borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 8 },
  rates: { fontSize: 12, marginBottom: 12 },
});
