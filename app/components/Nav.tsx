"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "This week" },
  { href: "/funders", label: "Proven funders" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/tasks", label: "Tasks" },
  { href: "/policy", label: "Policy" },
  { href: "/paste", label: "Paste a link" },
  { href: "/digest/latest", label: "Digest" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4" aria-label="Main">
      <ul className="flex gap-1 whitespace-nowrap text-sm">
        {LINKS.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block rounded-md px-2.5 py-1.5 ${active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-200"}`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
