import { useColorScheme } from "react-native";

/** Same palette as the web, so the brief looks like one product on both. */
const light = {
  bg: "#fafafb",
  panel: "#ffffff",
  line: "#e4e6ea",
  ink: "#111318",
  muted: "#5f6570",
  accent: "#1a56f0",
  urgent: "#d92d20",
  ok: "#12803c",
  faint: "#9aa0aa",
  chart: "#1f5eff",
  band: "#eceef2",
  good: "#128a45",
  bad: "#dc2626",
};

const dark: typeof light = {
  bg: "#0f1115",
  panel: "#171a20",
  line: "#2a2e37",
  ink: "#eceef2",
  muted: "#9aa1ad",
  accent: "#6b9bff",
  urgent: "#ff7a6b",
  ok: "#5fd38a",
  faint: "#666d7a",
  chart: "#5b8dff",
  band: "#262a33",
  good: "#34c26a",
  bad: "#f26b5b",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
