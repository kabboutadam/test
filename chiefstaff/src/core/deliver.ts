import type { Brief, User } from "@prisma/client";
import { db } from "@/lib/db";
import { briefToText, parseBrief, type Span } from "@/lib/brief-blocks";
import { mailConfigured, sendMail, type Envelope } from "@/lib/mail";
import { sendPush } from "@/lib/push";
import { localDateKey } from "@/lib/time";

/** Model output reaches an HTML email here, so it is escaped, not trusted. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function spansToHtml(spans: Span[]): string {
  return spans
    .map((span) => (span.bold ? `<strong>${escapeHtml(span.text)}</strong>` : escapeHtml(span.text)))
    .join("");
}

// Mail clients strip <style> unpredictably, so everything is inlined. Kept
// deliberately plain: this is read on a phone, one-handed, before coffee.
const STYLES = {
  body: "margin:0;padding:24px 16px;background:#fafafb;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111318;",
  wrap: "max-width:520px;margin:0 auto;",
  greeting: "font-size:20px;font-weight:600;letter-spacing:-0.02em;margin:0 0 4px;",
  date: "color:#5f6570;font-size:13px;margin:0 0 26px;",
  heading:
    "font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#1a56f0;margin:26px 0 10px;",
  paragraph: "margin:0 0 12px;",
  list: "margin:0 0 12px;padding-left:20px;",
  item: "margin:0 0 7px;",
  footer:
    "margin-top:34px;padding-top:16px;border-top:1px solid #e4e6ea;color:#5f6570;font-size:13px;",
  link: "color:#1a56f0;",
};

export function renderBriefEmail(user: User, brief: Brief, appUrl: string): Envelope {
  const html = parseBrief(brief.markdown)
    .map((block) => {
      if (block.type === "heading") return `<div style="${STYLES.heading}">${spansToHtml(block.spans)}</div>`;
      if (block.type === "list") {
        const items = block.items
          .map((item) => `<li style="${STYLES.item}">${spansToHtml(item)}</li>`)
          .join("");
        return `<ul style="${STYLES.list}">${items}</ul>`;
      }
      return `<p style="${STYLES.paragraph}">${spansToHtml(block.spans)}</p>`;
    })
    .join("");

  const firstName = user.name?.split(" ")[0];
  const dateLabel = brief.forDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return {
    to: user.email,
    // The subject is the brief's job in one line: they should be able to act
    // on it, or decide not to open it, from the notification alone.
    subject: `Your brief — ${dateLabel}`,
    html: `<body style="${STYLES.body}"><div style="${STYLES.wrap}">
<div style="${STYLES.greeting}">${firstName ? `Morning, ${escapeHtml(firstName)}` : "Your brief"}</div>
<div style="${STYLES.date}">${dateLabel}</div>
${html}
<div style="${STYLES.footer}">
<a href="${appUrl}/inbox" style="${STYLES.link}">Open your decision inbox</a> to approve drafts.
</div>
</div></body>`,
    text: [
      firstName ? `Morning, ${firstName}` : "Your brief",
      dateLabel,
      "",
      briefToText(brief.markdown),
      "",
      `Open your decision inbox to approve drafts: ${appUrl}/inbox`,
    ].join("\n"),
  };
}

/** The first "needs you" line, for the notification body. */
function headline(brief: Brief): string {
  const blocks = parseBrief(brief.markdown);
  const first = blocks.find((block) => block.type === "list");
  const text = first?.type === "list" ? first.items[0]?.map((span) => span.text).join("") : undefined;
  return text?.slice(0, 140) ?? "Your brief is ready.";
}

/**
 * Send today's brief, once, by every channel the executive has: email if
 * SMTP is configured, push to every linked phone. Delivered means at least
 * one channel actually reached them. Idempotent on `deliveredAt`, so a
 * retried or overlapping morning run cannot put a second copy in front of
 * them.
 */
export async function deliverBrief(
  user: User,
  brief: Brief,
): Promise<{ delivered: boolean; reason?: string; channels: string[] }> {
  if (brief.deliveredAt) {
    return { delivered: false, reason: "already delivered", channels: [] };
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const channels: string[] = [];
  const failures: string[] = [];

  // Channels are independent. An SMTP outage must not stop the push, and a
  // push outage must not stop the email — the whole point of two channels.
  try {
    const mail = await sendMail(renderBriefEmail(user, brief, appUrl));
    if (mail.sent) channels.push("email");
  } catch (error) {
    failures.push(`email: ${error instanceof Error ? error.message : error}`);
  }

  const devices = await db.device.findMany({ where: { userId: user.id } });
  if (devices.length > 0) {
    const push = await sendPush(
      devices.map((device) => ({
        to: device.expoPushToken,
        title: user.name ? `Morning, ${user.name.split(" ")[0]}` : "Your brief",
        body: headline(brief),
        data: { screen: "brief", briefId: brief.id },
      })),
    );
    if (push.sent > 0) channels.push(`push×${push.sent}`);
    if (push.failed > 0) failures.push(`push: ${push.failed} of ${devices.length} failed`);
    if (push.dead.length > 0) {
      // An uninstalled app leaves a token that fails forever. Forget it.
      await db.device.deleteMany({ where: { expoPushToken: { in: push.dead } } });
    }
  }

  if (failures.length > 0) console.warn(`  delivery for ${user.email}: ${failures.join("; ")}`);

  // Only a real send marks the brief delivered.
  if (channels.length === 0) {
    // A configured channel that failed is transient: throw, so the queue
    // retries with backoff. Nothing configured at all is not retryable —
    // report it and let the next scheduler pass try again once it is.
    if (mailConfigured() || devices.length > 0) {
      throw new Error(`brief reached nobody — ${failures.join("; ") || "no channel succeeded"}`);
    }
    return {
      delivered: false,
      reason: "no SMTP configured and no phones linked (brief logged, not sent)",
      channels,
    };
  }

  await db.brief.update({ where: { id: brief.id }, data: { deliveredAt: new Date() } });
  return { delivered: true, channels };
}

/** Today's brief in the executive's own timezone, if one exists. */
export async function briefForToday(user: User, now = new Date()): Promise<Brief | null> {
  return db.brief.findUnique({
    where: {
      userId_forDate: {
        userId: user.id,
        forDate: new Date(`${localDateKey(now, user.timezone)}T00:00:00.000Z`),
      },
    },
  });
}
