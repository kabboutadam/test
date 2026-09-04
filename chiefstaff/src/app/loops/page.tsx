import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { SignedOut } from "@/components/SignedOut";
import { closeLoop } from "../inbox/actions";

export const dynamic = "force-dynamic";

function daysOpen(since: Date): number {
  return Math.max(0, Math.floor((Date.now() - since.getTime()) / 86_400_000));
}

type LoopRow = Awaited<ReturnType<typeof loadLoops>>[number];

async function loadLoops(userId: string) {
  return db.loop.findMany({
    where: { userId, status: "waiting" },
    orderBy: { askedAt: "asc" },
    include: { person: true, signal: true },
  });
}

function LoopCard({ loop, mine }: { loop: LoopRow; mine: boolean }) {
  const age = daysOpen(loop.askedAt);
  const overdue = loop.dueAt ? loop.dueAt.getTime() < Date.now() : age >= 7;
  return (
    <article className="card">
      <div className="meta">
        <span className={overdue ? "tag u3" : "tag"}>{age === 0 ? "today" : `${age}d`}</span>
        <span>{mine ? "you promised " : ""}{loop.person?.name ?? loop.person?.email ?? "unassigned"}</span>
        {loop.dueAt && <span className={overdue ? "stale" : undefined}>due {loop.dueAt.toISOString().slice(0, 10)}</span>}
        {loop.signal?.url && <a href={loop.signal.url} target="_blank" rel="noreferrer">source</a>}
      </div>
      <h3>{loop.ask}</h3>
      <form className="actions">
        <button formAction={async () => { "use server"; await closeLoop(loop.id, "answered"); }}>{mine ? "Done" : "Answered"}</button>
        <button formAction={async () => { "use server"; await closeLoop(loop.id, "dropped"); }}>Drop it</button>
      </form>
    </article>
  );
}

export default async function LoopsPage() {
  const user = await currentUser();
  if (!user) return <SignedOut />;

  const loops = await loadLoops(user.id);
  const theyOwe = loops.filter((loop) => loop.direction === "owed_to_me");
  const iOwe = loops.filter((loop) => loop.direction === "owed_by_me");

  return (
    <main>
      <h1>You&rsquo;re waiting on</h1>
      <p className="lede">Things you asked for that haven&rsquo;t come back. Oldest first.</p>
      {theyOwe.map((loop) => <LoopCard key={loop.id} loop={loop} mine={false} />)}
      {theyOwe.length === 0 && <p className="empty">Nothing outstanding. Everyone has come back to you.</p>}

      {iOwe.length > 0 && (
        <>
          <h2>You owe</h2>
          <p className="why">Things you said you&rsquo;d do. The other half of every 1:1.</p>
          {iOwe.map((loop) => <LoopCard key={loop.id} loop={loop} mine />)}
        </>
      )}
    </main>
  );
}
