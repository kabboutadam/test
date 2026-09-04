import { useColorScheme } from "react-native";

/** Same palette as the web, so the brief looks like one product on both. */
const light = {
  bg: "#fbfbfa",
  panel: "#ffffff",
  line: "#e6e4e0",
  ink: "#1c1b19",
  muted: "#6f6b66",
  accent: "#8a4b2a",
  urgent: "#a8321f",
  ok: "#2f6b45",
};

const dark: typeof light = {
  bg: "#16151a",
  panel: "#1e1d23",
  line: "#302e37",
  ink: "#ece9e4",
  muted: "#9b958d",
  accent: "#d9a07a",
  urgent: "#e0705c",
  ok: "#7cb894",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
