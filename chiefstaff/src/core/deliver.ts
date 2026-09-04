import type { Brief, User } from "@prisma/client";
import { db } from "@/lib/db";
import { briefToText, parseBrief, type Span } from "@/lib/brief-blocks";
import { sendMail, type Envelope } from "@/lib/mail";
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
  body: "margin:0;padding:24px 16px;background:#fbfbfa;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1b19;",
  wrap: "max-width:520px;margin:0 auto;",
  greeting: "font-size:20px;font-weight:600;letter-spacing:-0.02em;margin:0 0 4px;",
  date: "color:#6f6b66;font-size:13px;margin:0 0 26px;",
  heading:
    "font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#8a4b2a;margin:26px 0 10px;",
  paragraph: "margin:0 0 12px;",
  list: "margin:0 0 12px;padding-left:20px;",
  item: "margin:0 0 7px;",
  footer:
    "margin-top:34px;padding-top:16px;border-top:1px solid #e6e4e0;color:#6f6b66;font-size:13px;",
  link: "color:#8a4b2a;",
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

/**
 * Send today's brief, once. Idempotent on `deliveredAt`, so a retried or
 * overlapping morning run cannot put a second copy in front of the executive.
 */
export async function deliverBrief(
  user: User,
  brief: Brief,
): Promise<{ delivered: boolean; reason?: string }> {
  if (brief.deliveredAt) {
    return { delivered: false, reason: "already delivered" };
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const result = await sendMail(renderBriefEmail(user, brief, appUrl));

  // Only a real send marks the brief delivered. Without SMTP configured the
  // brief stays undelivered so it goes out for real once mail is wired up.
  if (!result.sent) {
    return { delivered: false, reason: "no SMTP configured (brief logged, not sent)" };
  }

  await db.brief.update({ where: { id: brief.id }, data: { deliveredAt: new Date() } });
  return { delivered: true };
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
