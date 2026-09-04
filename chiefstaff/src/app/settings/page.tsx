import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { googleConfigured } from "@/lib/env";
import { linkPhone } from "../inbox/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await currentUser();
  const connections = user
    ? await db.connection.findMany({ where: { userId: user.id } })
    : [];
  const [liveCode, devices] = user
    ? await Promise.all([
        db.linkCode.findFirst({
          where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        }),
        db.device.count({ where: { userId: user.id } }),
      ])
    : [null, 0];

  return (
    <main>
      <h1>Settings</h1>
      <p className="lede">
        {user ? `Signed in as ${user.email}` : "Not signed in."}
      </p>

      <h2>Connected sources</h2>

      {connections.map((connection) => (
        <article key={connection.id} className="card">
          <div className="meta">
            <span className="tag">{connection.provider}</span>
            <span>
              {connection.lastSyncAt
                ? `last synced ${connection.lastSyncAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
                : "never synced"}
            </span>
          </div>
          <h3>{connection.accountEmail}</h3>
          <p className="why">Read-only: Gmail and Calendar. ChiefStaff cannot send as you.</p>
        </article>
      ))}

      {connections.length === 0 && (
        <p className="empty">No sources connected yet.</p>
      )}

      {googleConfigured() ? (
        <a href="/api/auth/google">
          <button className="primary">
            {connections.length ? "Connect another account" : "Connect Google Workspace"}
          </button>
        </a>
      ) : (
        <p className="empty">
          Google OAuth is not configured. Set <code>GOOGLE_CLIENT_ID</code> and{" "}
          <code>GOOGLE_CLIENT_SECRET</code> in <code>.env</code> to enable it.
        </p>
      )}

      <h2>Phone</h2>
      <p className="why">
        {devices === 0
          ? "No phone linked. The brief arrives by push at your brief hour once one is."
          : `${devices} ${devices === 1 ? "phone" : "phones"} linked.`}
      </p>
      {liveCode ? (
        <article className="card">
          <div className="meta">
            <span>expires {liveCode.expiresAt.toLocaleTimeString("en-US", { timeStyle: "short" })}</span>
          </div>
          <h3 style={{ fontSize: 30, letterSpacing: "0.18em", fontVariantNumeric: "tabular-nums" }}>
            {liveCode.code.slice(0, 3)} {liveCode.code.slice(3)}
          </h3>
          <p className="why">Open ChiefStaff on your phone and type this code.</p>
        </article>
      ) : (
        user && (
          <form action={linkPhone}>
            <button>{devices ? "Link another phone" : "Link your phone"}</button>
          </form>
        )
      )}

      <h2>What this reads</h2>
      <p className="why">
        Everything is read with your own Google credentials, so ChiefStaff can only ever see what
        you can see. It requests read-only scopes and holds no send or write permission. Drafts are
        generated for your approval and are never delivered by this system.
      </p>
    </main>
  );
}
