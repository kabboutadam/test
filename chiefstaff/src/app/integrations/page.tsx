import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { SignedOut } from "@/components/SignedOut";
import { ApiKeyForm, ConnectForm } from "@/components/ConnectForm";
import { CATALOG, listIntegrations } from "@/core/integrations";
import { phoneServerUrl } from "@/lib/lan";
import { removeAction, revokeApiKeyAction, syncIntegrationsAction } from "./actions";

export const dynamic = "force-dynamic";

const FORMS: Record<string, { fields: { name: string; label: string; type?: string; placeholder?: string; hint?: string }[]; submit: string }> = {
  imap: {
    submit: "Connect mailbox",
    fields: [
      { name: "user", label: "Email address", type: "email", placeholder: "you@company.com" },
      { name: "password", label: "App password", type: "password", hint: "Not your login password. iCloud: appleid.apple.com → App-specific passwords. Gmail: myaccount.google.com → App passwords. Fastmail, Yahoo, Zoho: Settings → App passwords." },
      { name: "host", label: "IMAP server", placeholder: "imap.mail.me.com", hint: "iCloud imap.mail.me.com · Gmail imap.gmail.com · Fastmail imap.fastmail.com · Yahoo imap.mail.yahoo.com · Zoho imap.zoho.com" },
      { name: "port", label: "Port", placeholder: "993" },
      { name: "label", label: "Name it (optional)", placeholder: "Work mail" },
    ],
  },
  ics: {
    submit: "Connect calendar",
    fields: [
      { name: "url", label: "ICS link", placeholder: "https://outlook.office365.com/owa/calendar/…/calendar.ics", hint: "Outlook: Settings → Calendar → Shared calendars → Publish → ICS. Google: calendar settings → Secret address in iCal format. iCloud: share calendar → Public → copy link." },
      { name: "label", label: "Name it (optional)", placeholder: "Outlook calendar" },
    ],
  },
  csv_url: {
    submit: "Connect spreadsheet",
    fields: [
      { name: "url", label: "CSV link", placeholder: "https://docs.google.com/spreadsheets/d/e/…/pub?output=csv", hint: "Google Sheets: File → Share → Publish to web → choose the sheet → CSV → copy link. Columns: metric, period, value; optional segment, unit, good_when, owner." },
      { name: "label", label: "Name it (optional)", placeholder: "Finance sheet" },
    ],
  },
};

const OAUTH: Record<string, { href: string; button: string; vars: string[]; setup: string }> = {
  google: { href: "/api/auth/google", button: "Connect Google", vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], setup: "console.cloud.google.com → APIs & Services → Credentials → OAuth client (Web). Redirect URI: http://localhost:3000/api/auth/google/callback" },
  microsoft: { href: "/api/auth/microsoft", button: "Connect Microsoft", vars: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"], setup: "portal.azure.com → App registrations → New. Account type: any org and personal Microsoft accounts. Redirect URI (Web): http://localhost:3000/api/auth/microsoft/callback. Then Certificates & secrets → New client secret; copy the Value." },
};

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const { error, connected: justConnected } = await searchParams;
  const user = await currentUser();
  if (!user) return <SignedOut />;
  const [connected, keys] = await Promise.all([
    listIntegrations(user.id),
    db.apiToken.findMany({ where: { userId: user.id, revokedAt: null, label: { not: { startsWith: "phone" } } }, orderBy: { createdAt: "desc" } }),
  ]);
  const base = phoneServerUrl();
  const native = CATALOG.filter((entry) => entry.how !== "via");
  const via = CATALOG.filter((entry) => entry.how === "via");

  return (
    <main>
      <h1>Connect</h1>
      <p className="lede">
        Everything here is read-only and pulled on every sync. Passwords and links are stored encrypted and never shown again.
      </p>

      {error && <p className="form-error">Could not connect: {decodeURIComponent(error).replace(/_/g, " ")}.</p>}
      {justConnected && <p className="form-ok">Connected. The next sync pulls the last week of mail and the next three days of meetings.</p>}

      <h2>Connected</h2>
      {connected.length === 0 && <p className="empty">Nothing yet. The seeded day keeps working until something is connected.</p>}
      {connected.map((item) => (
        <article key={item.id} className={`card${item.status === "error" ? " u3" : ""}`}>
          <div className="meta">
            <span className="tag">{item.kind.replace("_", " ")}</span>
            <span className={`tag ${item.status === "error" ? "u3" : "good"}`}>{item.status === "error" ? "error" : "ok"}</span>
            <span>{item.lastSyncAt ? `last synced ${new Date(item.lastSyncAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone })}` : "not synced yet"}</span>
          </div>
          <h3>{item.label}</h3>
          {item.account && <p className="why">{item.account}</p>}
          {item.lastError && <p className="form-error">{item.lastError}</p>}
          <form className="actions">
            <button formAction={syncIntegrationsAction}>Sync now</button>
            <button formAction={async () => { "use server"; await removeAction(item.id); }}>Remove</button>
          </form>
        </article>
      ))}

      <h2>Add a source</h2>
      <div className="catalog">
        {native.map((entry) => (
          <article key={entry.id} className="card catalog-card">
            <div className="meta">
              <span className="tag">{entry.group}</span>
            </div>
            <h3>{entry.name}</h3>
            <p className="why">{entry.brings}</p>
            {entry.note && <p className="sub">{entry.note}</p>}
            {entry.how === "oauth" &&
              (entry.ready ? (
                <a href={OAUTH[entry.id].href}><button className="primary">{OAUTH[entry.id].button}</button></a>
              ) : (
                <p className="sub">
                  Set <code>{OAUTH[entry.id].vars[0]}</code> and <code>{OAUTH[entry.id].vars[1]}</code> in <code>.env</code>, restart, and this button appears.
                  <br />
                  {OAUTH[entry.id].setup}
                </p>
              ))}
            {entry.how === "form" && <ConnectForm kind={entry.id} fields={FORMS[entry.id].fields} submit={FORMS[entry.id].submit} />}
            {entry.how === "key" && (
              <>
                <ApiKeyForm />
                {keys.length > 0 && (
                  <div className="keys">
                    {keys.map((key) => (
                      <div key={key.id} className="loop-row">
                        <div className="loop-body">
                          <div className="loop-ask">{key.label}</div>
                          <div className="loop-who">
                            created {key.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
                            {key.lastUsedAt ? ` · last used ${key.lastUsedAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}` : " · never used"}
                          </div>
                        </div>
                        <form><button formAction={async () => { "use server"; await revokeApiKeyAction(key.id); }}>Revoke</button></form>
                      </div>
                    ))}
                  </div>
                )}
                <details className="howto">
                  <summary>How to push data</summary>
                  <p className="sub">Numbers (same columns as the CSV import):</p>
                  <pre className="code">{`POST ${base}/api/v1/metrics
Authorization: Bearer cs_…
Content-Type: application/json

{"rows":[{"metric":"Revenue","period":"2026-09-01","value":4300000,"unit":"€","good_when":"up"}]}`}</pre>
                  <p className="sub">Messages (a Slack mention, a ticket, anything that may need you):</p>
                  <pre className="code">{`POST ${base}/api/v1/signals
Authorization: Bearer cs_…
Content-Type: application/json

{"items":[{"id":"slack-1234","subject":"Ines: can we restart the night shift?","text":"…","from":"ines@company.com","url":"https://slack.com/…"}]}`}</pre>
                  <p className="sub">In Zapier or Make, pick "Webhooks → POST" as the action and paste the block above. The key works from anywhere that can reach this server.</p>
                </details>
              </>
            )}
          </article>
        ))}
      </div>

      <h2>Reachable through the API key today</h2>
      <div className="catalog">
        {via.map((entry) => (
          <article key={entry.id} className="card catalog-card quiet">
            <div className="meta"><span className="tag">{entry.group}</span></div>
            <h3>{entry.name}</h3>
            <p className="why">{entry.brings}</p>
            {entry.note && <p className="sub">{entry.note}</p>}
          </article>
        ))}
      </div>
    </main>
  );
}
