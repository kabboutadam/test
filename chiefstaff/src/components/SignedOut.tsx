import Link from "next/link";

export function SignedOut() {
  return (
    <main>
      <h1>Not connected</h1>
      <p className="lede">
        ChiefStaff reads your mail and calendar as you, so it needs your Google account before it
        can tell you anything.
      </p>
      <Link href="/settings">
        <button className="primary">Connect Google Workspace</button>
      </Link>
    </main>
  );
}
