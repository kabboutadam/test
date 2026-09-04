import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChiefStaff",
  description: "A daily brief and decision inbox for executives.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="top">
            <div className="brand">
              ChiefStaff <span>· decision inbox</span>
            </div>
            <nav className="top">
              <Link href="/brief">Brief</Link>
              <Link href="/inbox">Inbox</Link>
              <Link href="/loops">Waiting on</Link>
              <Link href="/metrics">Moved</Link>
              <Link href="/decisions">Decisions</Link>
              <Link href="/settings">Settings</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
