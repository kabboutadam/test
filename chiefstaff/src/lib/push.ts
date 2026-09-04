/**
 * Push notifications through Expo's push service. Free, no account: the app
 * registers an Expo push token, we POST to exp.host, Expo relays to APNs/FCM.
 *
 * Best-effort by design. A push that fails must never block the brief — the
 * email is the durable copy — so failures are logged and reported, not thrown.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** A push provider that hangs must not hold up the brief. */
const PUSH_TIMEOUT_MS = 10_000;

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Tokens Expo reports as no longer valid; the caller should forget them. */
  dead: string[];
}

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

export async function sendPush(messages: PushMessage[]): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, dead: [] };
  if (messages.length === 0) return result;

  let tickets: ExpoTicket[];
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(
        messages.map((message) => ({ ...message, sound: "default", priority: "high" })),
      ),
    });
    if (!response.ok) {
      console.warn(`push: expo responded ${response.status}`);
      result.failed = messages.length;
      return result;
    }
    tickets = ((await response.json()) as { data?: ExpoTicket[] }).data ?? [];
  } catch (error) {
    console.warn(`push: request failed — ${error instanceof Error ? error.message : error}`);
    result.failed = messages.length;
    return result;
  }

  tickets.forEach((ticket, index) => {
    if (ticket.status === "ok") {
      result.sent++;
      return;
    }
    result.failed++;
    // An uninstalled app leaves a token that will fail forever.
    if (ticket.details?.error === "DeviceNotRegistered") result.dead.push(messages[index].to);
  });

  return result;
}
