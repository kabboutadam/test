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

export function Card({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.panel, borderColor: t.line }]}>{children}</View>;
}

export function Tag({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "urgent" | "warm" }) {
  const t = useTheme();
  const color = tone === "urgent" ? t.urgent : tone === "warm" ? t.accent : t.muted;
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
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  button: { borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignItems: "center" },
  buttonText: { fontSize: 14, fontWeight: "600" },
  empty: { fontSize: 15, lineHeight: 22, paddingVertical: 28 },
});
