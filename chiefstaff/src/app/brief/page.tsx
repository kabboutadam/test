import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { Markdown } from "@/lib/markdown";
import { SignedOut } from "@/components/SignedOut";
import { syncNow } from "../inbox/actions";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const user = await currentUser();
  if (!user) return <SignedOut />;

  const brief = await db.brief.findFirst({
    where: { userId: user.id },
    orderBy: { forDate: "desc" },
  });

  return (
    <main>
      <h1>{user.name ? `Morning, ${user.name.split(" ")[0]}` : "Your brief"}</h1>
      <p className="lede">
        {brief
          ? `Generated ${brief.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
          : "No brief yet."}
      </p>

      {brief ? (
        <Markdown source={brief.markdown} />
      ) : (
        <p className="empty">Run a sync to pull your mail and calendar and generate the first brief.</p>
      )}

      <form action={syncNow} style={{ marginTop: 28 }}>
        <button>Regenerate</button>
      </form>
    </main>
  );
}
