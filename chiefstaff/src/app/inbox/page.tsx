import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { DecisionCard } from "@/components/DecisionCard";
import { syncNow } from "./actions";
import { SignedOut } from "@/components/SignedOut";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await currentUser();
  if (!user) return <SignedOut />;

  const [decisions, people] = await Promise.all([
    db.decision.findMany({
      where: { userId: user.id, status: "open" },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
      include: { person: true },
    }),
    db.person.findMany({
      where: { userId: user.id, importance: { gte: 10 } },
      orderBy: { importance: "desc" },
      take: 20,
      select: { email: true, name: true },
    }),
  ]);

  return (
    <main>
      <h1>Decision inbox</h1>
      <p className="lede">
        {decisions.length === 0
          ? "Nothing is waiting on you."
          : `${decisions.length} ${decisions.length === 1 ? "thing needs" : "things need"} you. Drafts are ready — nothing sends without your approval.`}
      </p>

      {decisions.map((decision) => (
        <DecisionCard key={decision.id} decision={decision} people={people} />
      ))}

      {decisions.length === 0 && (
        <p className="empty">
          Everything triaged so far has been handled or was never yours. Sync to pull anything new.
        </p>
      )}

      <form action={syncNow} style={{ marginTop: 24 }}>
        <button>Sync now</button>
        <span style={{ marginLeft: 10, fontSize: 13, color: "var(--muted)" }}>
          queues a run — new items appear here shortly
        </span>
      </form>
    </main>
  );
}
