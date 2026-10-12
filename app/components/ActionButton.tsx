"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions";

/** Runs a server action and shows its one-line result. */
export function ActionButton({
  action, label, pendingLabel, variant = "secondary", disabled, confirm, size = "md",
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  confirm?: string;
  size?: "sm" | "md";
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const styles = {
    primary: "bg-accent text-accent-fg hover:opacity-90",
    secondary: "border border-line bg-surface text-fg hover:bg-surface-2",
    quiet: "text-fg-2 underline underline-offset-2 hover:text-fg",
  }[variant];
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setResult(await action()));
        }}
        className={`rounded-full font-medium disabled:cursor-not-allowed disabled:opacity-45 ${size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm"} ${styles}`}
      >
        {pending ? pendingLabel ?? "Working…" : label}
      </button>
      {result && <span role="status" className={`text-xs ${result.ok ? "text-fg-3" : "text-hot"}`}>{result.message}</span>}
    </span>
  );
}
