/**
 * A face for a name. No photos exist in the system, so it is initials on a
 * hue picked from the name — stable per person, so the same colour follows
 * them across every screen.
 */
export function Avatar({ name, email, size = 32 }: { name?: string | null; email?: string | null; size?: number }) {
  const label = (name ?? email ?? "?").trim();
  const initials = label
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;

  return (
    <span
      className="avatar"
      title={label}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: `oklch(0.82 0.06 ${hue})`, color: `oklch(0.32 0.08 ${hue})` }}
    >
      {initials || "?"}
    </span>
  );
}
