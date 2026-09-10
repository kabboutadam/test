import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { api, type Decision, type PersonRow } from "@/api";
import { useTheme } from "@/theme";
import { Avatar } from "./Avatar";
import { Button, Card, Tag } from "./ui";

const URGENCY = ["whenever", "this week", "today", "now"];

export function DecisionCard({
  decision,
  people,
  onResolved,
}: {
  decision: Decision;
  people: PersonRow[];
  onResolved: () => void;
}) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);

  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await work();
      onResolved();
    } finally {
      setBusy(false);
    }
  };
  const resolve = (status: "approved" | "dismissed") => act(() => api.resolveDecision(decision.id, status));

  const source = decision.citations[0];

  const stripe = decision.urgency === 3 ? t.urgent : decision.urgency === 2 ? t.accent : undefined;

  return (
    <Card stripe={stripe}>
      <View style={styles.meta}>
        {decision.person && <Avatar name={decision.person.name} email={decision.person.email} size={28} />}
        <View style={{ flex: 1, gap: 2 }}>
          {decision.person && (
            <Text style={[styles.who, { color: t.ink }]} numberOfLines={1}>
              {decision.person.name ?? decision.person.email}
            </Text>
          )}
          <View style={styles.tags}>
            <Tag tone={decision.urgency === 3 ? "urgent" : decision.urgency === 2 ? "warm" : "default"}>
              {URGENCY[decision.urgency]}
            </Tag>
            <Tag>{decision.category}</Tag>
          </View>
        </View>
      </View>

      <Text style={[styles.title, { color: t.ink }]}>{decision.title}</Text>
      <Text style={[styles.why, { color: t.muted }]}>{decision.why}</Text>

      {decision.draft && (
        <View style={[styles.draft, { backgroundColor: t.bg, borderColor: t.line, borderLeftColor: t.accent }]}>
          <Text style={[styles.draftText, { color: t.ink }]}>{decision.draft}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Button primary disabled={busy} onPress={() => void resolve("approved")}>
          {decision.draftKind === "email_reply" ? "Approve draft" : "Got it"}
        </Button>
        <Button disabled={busy} onPress={() => void resolve("dismissed")}>
          Not mine
        </Button>
        <Text style={[styles.link, { color: t.accent }]} onPress={() => setMore((value) => !value)}>
          {more ? "less" : "more"}
        </Text>
        {source && (
          <Text style={[styles.link, { color: t.accent }]} onPress={() => void Linking.openURL(source.url)}>
            source
          </Text>
        )}
      </View>

      {more && (
        <View style={styles.more}>
          <Text style={[styles.moreLabel, { color: t.muted }]}>Snooze</Text>
          <View style={styles.actions}>
            <Button disabled={busy} onPress={() => void act(() => api.snoozeDecision(decision.id, 1))}>Tomorrow</Button>
            <Button disabled={busy} onPress={() => void act(() => api.snoozeDecision(decision.id, 7))}>Next week</Button>
          </View>
          {people.length > 0 && (
            <>
              <Text style={[styles.moreLabel, { color: t.muted }]}>Delegate to</Text>
              <View style={[styles.actions, { flexWrap: "wrap" }]}>
                {people.slice(0, 6).map((person) => (
                  <Button key={person.email} disabled={busy} onPress={() => void act(() => api.delegateDecision(decision.id, person.email))}>
                    {(person.name ?? person.email).split(" ")[0]}
                  </Button>
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  who: { fontSize: 13, fontWeight: "600" },
  tags: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 16, fontWeight: "600", letterSpacing: -0.2, marginBottom: 4 },
  why: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  draft: { borderWidth: 1, borderLeftWidth: 2, borderRadius: 6, padding: 12, marginBottom: 12 },
  draftText: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  link: { fontSize: 13, marginLeft: 8 },
  more: { marginTop: 12, gap: 6 },
  moreLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 4 },
});
