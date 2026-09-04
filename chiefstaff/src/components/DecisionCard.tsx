import type { Decision, Person } from "@prisma/client";
import { resolveDecision } from "@/app/inbox/actions";

const URGENCY_LABEL = ["whenever", "this week", "today", "now"];

interface Citation {
  label: string;
  url: string;
}

export function DecisionCard({ decision }: { decision: Decision & { person: Person | null } }) {
  const citations = (decision.citations as unknown as Citation[]) ?? [];

  return (
    <article className="card">
      <div className="meta">
        <span className={`tag u${decision.urgency}`}>{URGENCY_LABEL[decision.urgency]}</span>
        <span className="tag">{decision.category}</span>
        {decision.person && <span>{decision.person.name ?? decision.person.email}</span>}
        {citations.map((citation) => (
          <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer">
            source
          </a>
        ))}
      </div>

      <h3>{decision.title}</h3>
      <p className="why">{decision.why}</p>

      {decision.draft && <pre className="draft">{decision.draft}</pre>}

      <form className="actions">
        <button
          className="primary"
          formAction={async () => {
            "use server";
            await resolveDecision(decision.id, "approved");
          }}
        >
          {decision.draftKind === "email_reply" ? "Approve draft" : "Got it"}
        </button>
        <button
          formAction={async () => {
            "use server";
            await resolveDecision(decision.id, "dismissed");
          }}
        >
          Not mine
        </button>
      </form>
    </article>
  );
}
