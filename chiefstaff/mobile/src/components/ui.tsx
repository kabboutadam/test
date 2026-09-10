import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";

/** The handful of primitives every screen is built from. */

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ flex: 1, backgroundColor: t.bg }, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.title, { color: t.ink }]}>{children}</Text>;
}

export function Lede({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.lede, { color: t.muted }]}>{children}</Text>;
}

/** Small caps section label, the same voice as the web's h2. */
export function Section({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.section, { color: t.accent }]}>{children}</Text>;
}

/**
 * A panel with an optional left stripe: urgency on inbox items, movement on
 * metrics. Shadowed lightly so cards lift off the page the way they do on web.
 */
export function Card({ children, stripe, style }: { children: ReactNode; stripe?: string; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.panel, borderColor: t.line, shadowColor: t.ink },
        stripe ? { borderLeftWidth: 3, borderLeftColor: stripe } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A headline number with the one line that says why it matters. */
export function StatTile({
  value,
  label,
  note,
  tone,
  onPress,
}: {
  value: number | string;
  label: string;
  note?: string;
  tone?: "bad" | "good";
  onPress?: () => void;
}) {
  const t = useTheme();
  const color = tone === "bad" ? t.bad : tone === "good" ? t.good : t.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.stat, { backgroundColor: t.panel, borderColor: t.line, shadowColor: t.ink, opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: t.ink }]}>{label}</Text>
      {note && (
        <Text style={[styles.statNote, { color: t.muted }]} numberOfLines={2}>
          {note}
        </Text>
      )}
    </Pressable>
  );
}

/** A horizontal rate bar: 4px rounded data-end, square at the baseline, value at the tip. */
export function RateBar({ rate, label, detail }: { rate: number; label: string; detail?: string }) {
  const t = useTheme();
  const pct = Math.round(rate * 100);
  return (
    <View style={styles.rate}>
      <View style={styles.rateHead}>
        <Text style={[styles.rateLabel, { color: t.ink }]}>{label}</Text>
        <Text style={[styles.rateValue, { color: t.ink }]}>{pct}%</Text>
      </View>
      <View style={[styles.rateTrack, { backgroundColor: t.band }]}>
        <View style={[styles.rateFill, { width: `${pct}%`, backgroundColor: t.chart }]} />
      </View>
      {detail && <Text style={[styles.rateDetail, { color: t.muted }]}>{detail}</Text>}
    </View>
  );
}

export function Tag({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "urgent" | "warm" | "good" }) {
  const t = useTheme();
  const color = tone === "urgent" ? t.urgent : tone === "warm" ? t.accent : tone === "good" ? t.good : t.muted;
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{children}</Text>
    </View>
  );
}

export function Button({
  children,
  onPress,
  primary,
  disabled,
}: {
  children: ReactNode;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? t.ink : t.panel,
          borderColor: primary ? t.ink : t.line,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? t.bg : t.ink }]}>{children}</Text>
    </Pressable>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.empty, { color: t.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.4, marginBottom: 4 },
  lede: { fontSize: 15, lineHeight: 21, marginBottom: 20 },
  section: { fontSize: 12.5, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 26, marginBottom: 10 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  stat: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  statValue: { fontSize: 32, fontWeight: "700", letterSpacing: -1, lineHeight: 36 },
  statLabel: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  statNote: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  rate: { marginBottom: 12 },
  rateHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  rateLabel: { fontSize: 13, fontWeight: "600" },
  rateValue: { fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  rateTrack: { height: 10, borderRadius: 5, overflow: "hidden" },
  rateFill: { height: 10, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  rateDetail: { fontSize: 12, marginTop: 4 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  button: { borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignItems: "center" },
  buttonText: { fontSize: 14, fontWeight: "600" },
  empty: { fontSize: 15, lineHeight: 22, paddingVertical: 28 },
});
