import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { SignedOut } from "@/components/SignedOut";
import { closeLoop } from "../inbox/actions";

export const dynamic = "force-dynamic";

function daysOpen(since: Date): number {
  return Math.max(0, Math.floor((Date.now() - since.getTime()) / 86_400_000));
}

export default async function LoopsPage() {
  const user = await currentUser();
  if (!user) return <SignedOut />;

  const loops = await db.loop.findMany({
    where: { userId: user.id, status: "waiting" },
    orderBy: { askedAt: "asc" },
    include: { person: true, signal: true },
  });

  return (
    <main>
      <h1>You&rsquo;re waiting on</h1>
      <p className="lede">
        Things you asked for that haven&rsquo;t come back. Oldest first.
      </p>

      {loops.map((loop) => {
        const age = daysOpen(loop.askedAt);
        const overdue = loop.dueAt ? loop.dueAt.getTime() < Date.now() : age >= 7;

        return (
          <article key={loop.id} className="card">
            <div className="meta">
              <span className={overdue ? "tag u3" : "tag"}>
                {age === 0 ? "today" : `${age}d`}
              </span>
              <span>{loop.person?.name ?? loop.person?.email ?? "unassigned"}</span>
              {loop.dueAt && (
                <span className={overdue ? "stale" : undefined}>
                  due {loop.dueAt.toISOString().slice(0, 10)}
                </span>
              )}
              {loop.signal?.url && (
                <a href={loop.signal.url} target="_blank" rel="noreferrer">
                  source
                </a>
              )}
            </div>

            <h3>{loop.ask}</h3>

            <form className="actions">
              <button
                formAction={async () => {
                  "use server";
                  await closeLoop(loop.id, "answered");
                }}
              >
                Answered
              </button>
              <button
                formAction={async () => {
                  "use server";
                  await closeLoop(loop.id, "dropped");
                }}
              >
                Drop it
              </button>
            </form>
          </article>
        );
      })}

      {loops.length === 0 && <p className="empty">Nothing outstanding. Everyone has come back to you.</p>}
    </main>
  );
}
