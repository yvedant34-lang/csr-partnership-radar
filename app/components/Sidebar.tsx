"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// HubSpot-style left navigation on desktop; a scrolling tab row on phones.
const ICON: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  leads: "M4 6h16M4 12h16M4 18h10",
  pipeline: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v5h-4z",
  tasks: "M9 11l3 3 8-8M4 12v7h16",
  funders: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z",
  policy: "M6 3h9l4 4v14H6zM14 3v5h5",
  paste: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  digest: "M3 6h18v12H3zM3 7l9 6 9-6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2m12 0h2M12 4v2m0 12v2",
};

export const NAV = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/leads", label: "Leads", icon: "leads" },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/funders", label: "Proven funders", icon: "funders" },
  { href: "/policy", label: "Policy", icon: "policy" },
  { href: "/paste", label: "Paste a link", icon: "paste" },
  { href: "/digest/latest", label: "Digest", icon: "digest" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

export function Sidebar() {
  const active = useActive();
  return (
    <nav aria-label="Main" className="space-y-0.5">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          prefetch={n.href.startsWith("/digest") ? false : undefined}
          aria-current={active(n.href) ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${active(n.href) ? "bg-surface-2 font-medium text-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg"}`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={ICON[n.icon]} />
          </svg>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const active = useActive();
  return (
    <nav aria-label="Main" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 whitespace-nowrap text-sm">
        {NAV.map((n) => (
          <li key={n.href}>
            <Link href={n.href} aria-current={active(n.href) ? "page" : undefined}
              className={`inline-block rounded-md px-2.5 py-1.5 ${active(n.href) ? "bg-accent text-accent-fg" : "text-fg-2"}`}>
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
