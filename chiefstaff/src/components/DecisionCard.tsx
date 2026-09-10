import Link from "next/link";
import type { Decision, Person } from "@prisma/client";
import { delegateDecision, resolveDecision, snoozeDecision } from "@/app/inbox/actions";
import { Avatar } from "./Avatar";

const URGENCY_LABEL = ["whenever", "this week", "today", "now"];

interface Citation {
  label: string;
  url: string;
}

export function DecisionCard({
  decision,
  people,
}: {
  decision: Decision & { person: Person | null };
  people: Pick<Person, "email" | "name">[];
}) {
  const citations = (decision.citations as unknown as Citation[]) ?? [];
  const logHref = `/decisions?from=${decision.id}&title=${encodeURIComponent(decision.title)}&why=${encodeURIComponent(decision.why)}`;

  return (
    <article className={`card${decision.urgency >= 2 ? ` u${decision.urgency}` : ""}`}>
      <div className="meta">
        <span className={`tag u${decision.urgency}`}>{URGENCY_LABEL[decision.urgency]}</span>
        <span className="tag">{decision.category}</span>
        {decision.person && (
          <span className="person">
            <Avatar name={decision.person.name} email={decision.person.email} size={20} />
            {decision.person.name ?? decision.person.email}
          </span>
        )}
        {citations.map((citation) => (
          <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer">source</a>
        ))}
      </div>

      <h3>{decision.title}</h3>
      <p className="why">{decision.why}</p>

      {decision.draft && <pre className="draft">{decision.draft}</pre>}

      <form className="actions" style={{ flexWrap: "wrap" }}>
        <button className="primary" formAction={async () => { "use server"; await resolveDecision(decision.id, "approved"); }}>
          {decision.draftKind === "email_reply" ? "Approve draft" : "Got it"}
        </button>
        <button formAction={async () => { "use server"; await resolveDecision(decision.id, "dismissed"); }}>Not mine</button>
        <button formAction={async () => { "use server"; await snoozeDecision(decision.id, 1); }}>Tomorrow</button>
        <button formAction={async () => { "use server"; await snoozeDecision(decision.id, 7); }}>Next week</button>
        {decision.category !== "review" && (
          <Link href={logHref} style={{ fontSize: 13, marginLeft: 4 }}>log as decision</Link>
        )}
      </form>

      {people.length > 0 && (
        <form
          className="actions"
          style={{ marginTop: 8 }}
          action={async (formData: FormData) => {
            "use server";
            const to = String(formData.get("to") ?? "");
            if (to) await delegateDecision(decision.id, to);
          }}
        >
          <select name="to" defaultValue="">
            <option value="">delegate to…</option>
            {people.map((person) => (
              <option key={person.email} value={person.email}>{person.name ?? person.email}</option>
            ))}
          </select>
          <button>Delegate</button>
        </form>
      )}
    </article>
  );
}
