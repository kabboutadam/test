import Link from "next/link";

/** A headline number with the one line that says why it matters. */
export function StatTile({ value, label, note, href, tone }: { value: number | string; label: string; note?: string; href?: string; tone?: "bad" | "good" }) {
  const body = (
    <>
      <div className={`stat-value${tone ? ` stat-${tone}` : ""}`}>{value}</div>
      <div className="stat-label">{label}</div>
      {note && <div className="stat-note">{note}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="stat">
      {body}
    </Link>
  ) : (
    <div className="stat">{body}</div>
  );
}
