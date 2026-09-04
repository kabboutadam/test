import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { DecisionCard } from "@/components/DecisionCard";
import { syncNow } from "./actions";
import { SignedOut } from "@/components/SignedOut";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await currentUser();
  if (!user) return <SignedOut />;

  const decisions = await db.decision.findMany({
    where: { userId: user.id, status: "open" },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    include: { person: true },
  });

  return (
    <main>
      <h1>Decision inbox</h1>
      <p className="lede">
        {decisions.length === 0
          ? "Nothing is waiting on you."
          : `${decisions.length} ${decisions.length === 1 ? "thing needs" : "things need"} you. Drafts are ready — nothing sends without your approval.`}
      </p>

      {decisions.map((decision) => (
        <DecisionCard key={decision.id} decision={decision} />
      ))}

      {decisions.length === 0 && (
        <p className="empty">
          Everything triaged so far has been handled or was never yours. Sync to pull anything new.
        </p>
      )}

      <form action={syncNow} style={{ marginTop: 24 }}>
        <button>Sync now</button>
      </form>
    </main>
  );
}
