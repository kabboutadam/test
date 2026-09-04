import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound mail. This sends *to* the executive — the daily brief — and never
 * on their behalf; the product drafts replies but a human sends them. Keeping
 * that boundary in one file makes it easy to check it still holds.
 */

export interface Envelope {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transport: Transporter | null = null;

/** True when a real SMTP endpoint is configured; otherwise mail is logged. */
export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_URL);
}

function transporter(): Transporter {
  if (transport) return transport;

  transport = process.env.SMTP_URL
    ? nodemailer.createTransport(process.env.SMTP_URL)
    : // No SMTP configured: capture rather than send, so a misconfigured
      // deployment is loud and local development needs no credentials.
      nodemailer.createTransport({ jsonTransport: true });

  return transport;
}

export async function sendMail(envelope: Envelope): Promise<{ sent: boolean; id?: string }> {
  const from = process.env.MAIL_FROM ?? "ChiefStaff <chiefstaff@localhost>";
  const info = await transporter().sendMail({ from, ...envelope });

  if (!mailConfigured()) {
    console.log(
      `\n[mail not sent — SMTP_URL unset]\n  to:      ${envelope.to}\n  subject: ${envelope.subject}\n`,
    );
    console.log(envelope.text);
    return { sent: false };
  }

  return { sent: true, id: info.messageId };
}
