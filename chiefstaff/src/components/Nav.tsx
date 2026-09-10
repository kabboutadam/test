"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/brief", "Brief"],
  ["/inbox", "Inbox"],
  ["/loops", "Waiting on"],
  ["/metrics", "Moved"],
  ["/decisions", "Decisions"],
  ["/settings", "Settings"],
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="top">
      {ITEMS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
