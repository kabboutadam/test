import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { api, type Decision } from "@/api";
import { useTheme } from "@/theme";
import { Button, Card, Tag } from "./ui";

const URGENCY = ["whenever", "this week", "today", "now"];

export function DecisionCard({ decision, onResolved }: { decision: Decision; onResolved: () => void }) {
  const t = useTheme();
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

  const source = decision.citations[0];

  return (
    <Card>
      <View style={styles.meta}>
        <Tag tone={decision.urgency === 3 ? "urgent" : decision.urgency === 2 ? "warm" : "default"}>
          {URGENCY[decision.urgency]}
        </Tag>
        <Tag>{decision.category}</Tag>
        {decision.person && (
          <Text style={[styles.metaText, { color: t.muted }]} numberOfLines={1}>
            {decision.person.name ?? decision.person.email}
          </Text>
        )}
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
        {source && (
          <Text style={[styles.link, { color: t.accent }]} onPress={() => void Linking.openURL(source.url)}>
            source
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  metaText: { fontSize: 12, flexShrink: 1 },
  title: { fontSize: 16, fontWeight: "600", letterSpacing: -0.2, marginBottom: 4 },
  why: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  draft: { borderWidth: 1, borderLeftWidth: 2, borderRadius: 6, padding: 12, marginBottom: 12 },
  draftText: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  link: { fontSize: 13, marginLeft: "auto" },
});
