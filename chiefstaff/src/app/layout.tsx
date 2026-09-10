import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Avatar } from "@/components/Avatar";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "ChiefStaff",
  description: "A daily brief and decision inbox for executives.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="top">
            <div className="brand">
              <span className="brand-mark" aria-hidden />
              ChiefStaff
            </div>
            <Nav />
            {user && (
              <div className="who">
                <span className="who-name">{user.name ?? user.email}</span>
                <Avatar name={user.name} email={user.email} size={30} />
              </div>
            )}
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
