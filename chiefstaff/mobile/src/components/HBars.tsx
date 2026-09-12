import { StyleSheet, Text, View } from "react-native";
import type { Bar } from "@/api";
import { money } from "@/format";
import { useTheme } from "@/theme";

/** Ranked horizontal bars, one hue, value and share beside each. */
export function HBars({ rows, currency }: { rows: Bar[]; currency: string }) {
  const t = useTheme();
  const max = Math.max(...rows.map((row) => row.value)) || 1;
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={[styles.label, { color: t.ink }]} numberOfLines={1}>
            {row.label}
          </Text>
          <View style={[styles.track, { backgroundColor: t.band }]}>
            <View style={[styles.fill, { width: `${(row.value / max) * 100}%`, backgroundColor: t.chart }]} />
          </View>
          <Text style={[styles.value, { color: t.ink }]}>{money(row.value, currency)}</Text>
          <Text style={[styles.share, { color: t.faint }]}>{Math.round(row.share * 100)}%</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { width: "30%", fontSize: 12.5, fontWeight: "600" },
  track: { flex: 1, height: 12, borderTopRightRadius: 4, borderBottomRightRadius: 4, overflow: "hidden" },
  fill: { height: 12, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  value: { width: 50, textAlign: "right", fontSize: 12.5, fontVariant: ["tabular-nums"] },
  share: { width: 32, textAlign: "right", fontSize: 11.5, fontVariant: ["tabular-nums"] },
});
