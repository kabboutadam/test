import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import { getToken, setToken } from "./auth";

/**
 * Talks to the ChiefStaff server. Shapes here mirror src/app/api/v1 on the
 * server; if one changes, the other must.
 */

/** The build-time default; the executive can override it in the app. */
export const DEFAULT_API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "http://localhost:3000";

const URL_KEY = "chiefstaff.apiUrl";
let cachedUrl: string | undefined;

/**
 * Runtime-configurable, so a TestFlight build survives a server move or a
 * tunnel restart without a rebuild. Stored alongside the token.
 */
export async function getApiUrl(): Promise<string> {
  if (cachedUrl === undefined) cachedUrl = (await SecureStore.getItemAsync(URL_KEY)) ?? DEFAULT_API_URL;
  return cachedUrl;
}

export async function setApiUrl(url: string | null): Promise<void> {
  const cleaned = url?.trim().replace(/\/+$/, "") || null;
  cachedUrl = cleaned ?? DEFAULT_API_URL;
  if (cleaned) await SecureStore.setItemAsync(URL_KEY, cleaned);
  else await SecureStore.deleteItemAsync(URL_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const [token, base] = await Promise.all([getToken(), getApiUrl()]);
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 401) {
    // A revoked token is a sign-out, not an error to show.
    await setToken(null);
    throw new ApiError(401, "signed out");
  }

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new ApiError(response.status, data.error ?? `request failed (${response.status})`);
  return data;
}

// ---------------------------------------------------------------- shapes

export type Span = { bold: boolean; text: string };
export type Block =
  | { type: "heading"; spans: Span[] }
  | { type: "paragraph"; spans: Span[] }
  | { type: "list"; items: Span[][] };

export interface Brief {
  id: string;
  forDate: string;
  createdAt: string;
  blocks: Block[];
}

export interface Person {
  name: string | null;
  email: string;
}

export interface Decision {
  id: string;
  title: string;
  why: string;
  category: string;
  urgency: number;
  draft: string | null;
  draftKind: string | null;
  person: Person | null;
  citations: { label: string; url: string }[];
  createdAt: string;
}

export interface Loop {
  id: string;
  direction: "owed_to_me" | "owed_by_me";
  ask: string;
  askedAt: string;
  dueAt: string | null;
  daysOpen: number;
  person: Person | null;
  url: string | null;
}

export interface Movement {
  id: string;
  sentence: string;
  deviation: number;
  periodStart: string;
  metric: string;
  segment: string;
  owner: Person | null;
}

export interface DecisionRecord {
  id: string;
  title: string;
  rationale: string;
  expected: string;
  category: string;
  status: string;
  outcome: string | null;
  decidedAt: string;
  reviewAt: string;
  reviewRequested: boolean;
  owner: Person | null;
  metric: { name: string; expectedValue: number | null } | null;
}

export interface HitRates {
  byCategory: { name: string; hit: number; miss: number; mixed: number; total: number; rate: number }[];
  byDecider: { name: string; hit: number; miss: number; mixed: number; total: number; rate: number }[];
  closed: number;
}

export interface PrepSection {
  heading: string;
  lines: string[];
}

export interface Prep {
  id: string;
  title: string;
  startsAt: string;
  person: Person | null;
  sections: PrepSection[];
}

export interface PersonRow extends Person {
  relationship: string;
  importance: number;
}

export interface Me {
  name: string | null;
  email: string;
  role: string | null;
  company: string | null;
  timezone: string;
  briefHour: number;
  connected: boolean;
}

// ----------------------------------------------------------------- calls

export const api = {
  link: (code: string, device: string) =>
    call<{ token: string; user: { name: string | null; email: string } }>("/api/v1/auth/link", {
      method: "POST",
      body: JSON.stringify({ code, device }),
    }),
  signOut: () => call<{ ok: boolean }>("/api/v1/auth", { method: "DELETE" }),
  me: () => call<{ user: Me }>("/api/v1/me"),
  brief: () => call<{ brief: Brief | null }>("/api/v1/brief"),
  decisions: () => call<{ decisions: Decision[] }>("/api/v1/decisions"),
  resolveDecision: (id: string, status: "approved" | "dismissed") =>
    call<{ ok: boolean }>(`/api/v1/decisions/${id}`, { method: "POST", body: JSON.stringify({ status }) }),
  snoozeDecision: (id: string, days: number) =>
    call<{ ok: boolean }>(`/api/v1/decisions/${id}`, { method: "POST", body: JSON.stringify({ status: "snoozed", days }) }),
  delegateDecision: (id: string, to: string) =>
    call<{ ok: boolean }>(`/api/v1/decisions/${id}`, { method: "POST", body: JSON.stringify({ status: "delegated", to }) }),
  people: () => call<{ people: PersonRow[] }>("/api/v1/people"),
  movements: () => call<{ movements: Movement[] }>("/api/v1/movements"),
  markMovement: (id: string, status: "useful" | "not_useful") =>
    call<{ ok: boolean }>(`/api/v1/movements/${id}`, { method: "POST", body: JSON.stringify({ status }) }),
  decisionLog: () => call<{ records: DecisionRecord[]; rates: HitRates }>("/api/v1/decision-log"),
  logDecision: (input: { title: string; expected: string; rationale?: string; category?: string; reviewDays?: number; owner?: string }) =>
    call<{ id: string }>("/api/v1/decision-log", { method: "POST", body: JSON.stringify(input) }),
  recordOutcome: (id: string, status: "hit" | "miss" | "mixed" | "dropped", outcome: string) =>
    call<{ ok: boolean }>(`/api/v1/decision-log/${id}`, { method: "POST", body: JSON.stringify({ status, outcome }) }),
  preps: () => call<{ preps: Prep[] }>("/api/v1/preps"),
  loops: () => call<{ loops: Loop[] }>("/api/v1/loops"),
  closeLoop: (id: string, status: "answered" | "dropped") =>
    call<{ ok: boolean }>(`/api/v1/loops/${id}`, { method: "POST", body: JSON.stringify({ status }) }),
  sync: () => call<{ queued: boolean }>("/api/v1/sync", { method: "POST" }),
  testPush: () => call<{ sent: number; failed: number }>("/api/v1/devices/test", { method: "POST" }),
  registerDevice: (expoPushToken: string, platform: string) =>
    call<{ ok: boolean }>("/api/v1/devices", {
      method: "POST",
      body: JSON.stringify({ expoPushToken, platform }),
    }),
};

/** Load-once-with-refresh, the only data pattern the app needs. */
export function useFetch<T>(load: () => Promise<T>): {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await load());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "something went wrong");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
