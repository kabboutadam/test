import { StyleSheet, Text, View } from "react-native";

/** Initials on a hue picked from the name — the same colour follows a person everywhere. */
export function Avatar({ name, email, size = 32 }: { name?: string | null; email?: string | null; size?: number }) {
  const label = (name ?? email ?? "?").trim();
  const initials = label.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue} 32% 82%)` }]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.38), color: `hsl(${hue} 30% 28%)` }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  text: { fontWeight: "700", letterSpacing: 0.3 },
});
