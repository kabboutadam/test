import type { Integration, User } from "@prisma/client";
import { db } from "@/lib/db";
import { googleConfigured } from "@/lib/env";
import { open, seal } from "@/lib/secrets";
import { fetchImap, testImap, type ImapConfig } from "@/connectors/imap";
import { fetchIcs, testIcs } from "@/connectors/ics";
import { fetchCsvUrl, testCsvUrl } from "@/connectors/csv-url";
import { importMetricRows } from "./metrics";
import { storeSignals, type IngestResult } from "./ingest";

/**
 * The connector registry. Three kinds work with nothing but an account the
 * executive already has (a mailbox password, a calendar link, a spreadsheet
 * link); Google is OAuth; an API key covers everything else through Zapier,
 * Make or a script. Vendors that need their own app registration are listed
 * so the catalogue is honest about what is and is not wired.
 */
export type IntegrationKind = "imap" | "ics" | "csv_url";

export interface CatalogEntry {
  id: string;
  name: string;
  group: "Mail and calendar" | "Numbers" | "Anything else";
  brings: string;
  /** form: a settings form here; oauth: a redirect; key: an API key; via: not native, reached through the API key. */
  how: "form" | "oauth" | "key" | "via";
  note?: string;
  ready?: boolean;
}

export const CATALOG: CatalogEntry[] = [
  { id: "google", name: "Google Workspace", group: "Mail and calendar", brings: "Gmail and Google Calendar, read-only.", how: "oauth", ready: googleConfigured(), note: "Needs a free Google OAuth client in .env." },
  { id: "imap", name: "Any mailbox", group: "Mail and calendar", brings: "iCloud, Fastmail, Yahoo, Zoho, Gmail with an app password, company mail. Read-only over IMAP.", how: "form", note: "Microsoft accounts no longer accept passwords over IMAP; use the calendar link below for Outlook and ask for the Microsoft 365 connector." },
  { id: "ics", name: "Calendar link", group: "Mail and calendar", brings: "Outlook, Google, iCloud or any calendar published as an ICS link. Feeds today's meetings and 1:1 prep.", how: "form" },
  { id: "csv_url", name: "Spreadsheet link", group: "Numbers", brings: "A Google Sheet or Excel file published as CSV. Pulled on every sync into What moved and Sales.", how: "form" },
  { id: "api", name: "API key", group: "Anything else", brings: "Push numbers or messages from Zapier, Make, n8n or your own scripts. That covers QuickBooks, Xero, Toast, Gusto, HubSpot and Slack today.", how: "key" },
  { id: "microsoft", name: "Microsoft 365", group: "Mail and calendar", brings: "Outlook mail and calendar.", how: "via", note: "Needs an Azure app registration. Until then: the calendar link works for Outlook, and mail can arrive through Zapier." },
  { id: "slack", name: "Slack", group: "Anything else", brings: "Mentions and DMs as inbox items.", how: "via", note: "Needs a Slack app. Today: a Zapier zap 'new mention → ChiefStaff signal'." },
  { id: "quickbooks", name: "QuickBooks / Xero", group: "Numbers", brings: "Revenue, margin, AR ageing.", how: "via", note: "Needs an Intuit or Xero developer app. Today: a scheduled Zapier zap posts the report rows." },
  { id: "toast", name: "Toast / Gusto", group: "Numbers", brings: "Sales and labour by location.", how: "via", note: "Partner API access required. Today: their scheduled CSV export, published as a spreadsheet link." },
];

export type PublicIntegration = {
  id: string;
  kind: string;
  label: string;
  account: string;
  status: "ok" | "error";
  lastError: string | null;
  lastSyncAt: string | null;
};

/** Everything connected for one person, Google included, with no secrets. */
export async function listIntegrations(userId: string): Promise<PublicIntegration[]> {
  const [connections, integrations] = await Promise.all([
    db.connection.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.integration.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);
  return [
    ...connections.map((connection) => ({
      id: connection.id,
      kind: connection.provider,
      label: "Google Workspace",
      account: connection.accountEmail,
      status: "ok" as const,
      lastError: null,
      lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
    })),
    ...integrations.map((integration) => ({
      id: integration.id,
      kind: integration.kind,
      label: integration.label,
      account: accountOf(integration),
      status: integration.status === "error" ? ("error" as const) : ("ok" as const),
      lastError: integration.lastError,
      lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
    })),
  ];
}

function accountOf(integration: Integration): string {
  const config = integration.config as Record<string, unknown>;
  if (integration.kind === "imap") return `${config.user} @ ${config.host}`;
  if (typeof config.urlHost === "string") return config.urlHost;
  return "";
}

export interface ConnectInput {
  kind: IntegrationKind;
  label: string;
  /** imap */
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  /** ics, csv_url */
  url?: string;
}

/** Verify the source actually answers before saving it; return what we saw. */
export async function connectIntegration(user: User, input: ConnectInput): Promise<{ id: string; summary: string }> {
  if (input.kind === "imap") {
    const config: ImapConfig = {
      host: (input.host ?? "").trim(),
      port: input.port || 993,
      secure: (input.port || 993) !== 143,
      user: (input.user ?? "").trim(),
    };
    if (!config.host || !config.user || !input.password) throw new Error("host, email and app password are all needed");
    const { messages } = await testImap(config, input.password);
    const created = await db.integration.create({
      data: { userId: user.id, kind: "imap", label: input.label || config.user, config: { ...config }, secret: seal(input.password) },
    });
    return { id: created.id, summary: `connected; ${messages} messages in the inbox` };
  }

  const url = (input.url ?? "").trim();
  if (!/^(https?|webcal):\/\//i.test(url)) throw new Error("that is not a link");
  const urlHost = new URL(url.replace(/^webcal:/i, "https:")).host;

  if (input.kind === "ics") {
    const { events } = await testIcs(url);
    const created = await db.integration.create({
      data: { userId: user.id, kind: "ics", label: input.label || `Calendar (${urlHost})`, config: { urlHost }, secret: seal(url) },
    });
    return { id: created.id, summary: `connected; ${events} events in the feed` };
  }

  const { rows, metrics } = await testCsvUrl(url);
  const created = await db.integration.create({
    data: { userId: user.id, kind: "csv_url", label: input.label || `Spreadsheet (${urlHost})`, config: { urlHost }, secret: seal(url) },
  });
  return { id: created.id, summary: `connected; ${rows} rows across ${metrics} metrics` };
}

export async function removeIntegration(userId: string, id: string): Promise<void> {
  await db.integration.deleteMany({ where: { id, userId } });
  await db.connection.deleteMany({ where: { id, userId } });
}

export interface IntegrationSync {
  signals: IngestResult;
  metrics: { metrics: number; points: number };
  errors: { label: string; error: string }[];
}

/**
 * Pull every non-Google source. One failing mailbox never blocks the rest:
 * the error is recorded on that integration and shown on the page.
 */
export async function syncIntegrations(user: User): Promise<IntegrationSync> {
  const integrations = await db.integration.findMany({ where: { userId: user.id } });
  const result: IntegrationSync = { signals: { fetched: 0, stored: 0, skipped: 0 }, metrics: { metrics: 0, points: 0 }, errors: [] };

  for (const integration of integrations) {
    try {
      let cursor = integration.cursor;
      if (integration.kind === "imap") {
        const config = integration.config as unknown as ImapConfig;
        const fetched = await fetchImap(config, open(integration.secret ?? ""), integration.cursor);
        const stored = await storeSignals(user, fetched.signals);
        add(result.signals, stored);
        cursor = fetched.cursor;
      } else if (integration.kind === "ics") {
        const stored = await storeSignals(user, await fetchIcs(open(integration.secret ?? "")));
        add(result.signals, stored);
      } else if (integration.kind === "csv_url") {
        const { rows } = await fetchCsvUrl(open(integration.secret ?? ""));
        const imported = await importMetricRows(user, rows, "csv_url");
        result.metrics.metrics += imported.metrics;
        result.metrics.points += imported.points;
      }
      await db.integration.update({ where: { id: integration.id }, data: { status: "ok", lastError: null, lastSyncAt: new Date(), cursor } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ label: integration.label, error: message });
      await db.integration.update({ where: { id: integration.id }, data: { status: "error", lastError: message.slice(0, 500), lastSyncAt: new Date() } });
    }
  }
  return result;
}

function add(total: IngestResult, part: IngestResult): void {
  total.fetched += part.fetched;
  total.stored += part.stored;
  total.skipped += part.skipped;
}

/** True when anything at all is connected, so sync has something to do. */
export async function hasSources(userId: string): Promise<boolean> {
  const [connections, integrations] = await Promise.all([
    db.connection.count({ where: { userId } }),
    db.integration.count({ where: { userId } }),
  ]);
  return connections + integrations > 0;
}
