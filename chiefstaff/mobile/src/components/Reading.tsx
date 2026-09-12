import { StyleSheet, Text, View } from "react-native";
import type { Reading as ReadingRow } from "@/api";
import { useTheme } from "@/theme";

/** The one line under a chart that says what it means. Tone has a word, not just a colour. */
export function Reading({ reading }: { reading: ReadingRow }) {
  const t = useTheme();
  const word = reading.tone === "bad" ? "Watch" : reading.tone === "good" ? "On track" : "Note";
  const color = reading.tone === "bad" ? t.urgent : reading.tone === "good" ? t.ok : t.muted;
  return (
    <View style={[styles.wrap, { backgroundColor: t.bg }]}>
      <View style={[styles.pill, { borderColor: color }]}>
        <Text style={[styles.word, { color }]}>{word}</Text>
      </View>
      <Text style={[styles.text, { color: t.ink }]}>{reading.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 8, marginTop: 12 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginTop: 1 },
  word: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  text: { flex: 1, fontSize: 13.5, lineHeight: 19 },
});
