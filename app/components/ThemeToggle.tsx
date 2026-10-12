"use client";

import { useTransition } from "react";
import { setTheme } from "@/app/actions";

export function ThemeToggle({ theme }: { theme: "light" | "dark" | "system" }) {
  const [pending, start] = useTransition();
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-full bg-surface-2 p-0.5 text-xs">
      {(["system", "light", "dark"] as const).map((t) => (
        <button key={t} type="button" role="radio" aria-checked={theme === t} disabled={pending}
          onClick={() => start(() => setTheme(t))}
          className={`rounded-full px-2.5 py-0.5 capitalize ${theme === t ? "bg-surface text-fg shadow-sm" : "text-fg-3 hover:text-fg"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}
