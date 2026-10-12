"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions";

/** Runs a server action and shows its one-line result. */
export function ActionButton({
  action, label, pendingLabel, variant = "secondary", disabled, confirm,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const styles = {
    primary: "bg-stone-900 text-white hover:bg-stone-700",
    secondary: "bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50",
    quiet: "text-stone-600 hover:text-stone-900 underline underline-offset-2",
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
        className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${styles}`}
      >
        {pending ? pendingLabel ?? "Working…" : label}
      </button>
      {result && (
        <span role="status" className={`text-xs ${result.ok ? "text-stone-600" : "text-red-700"}`}>{result.message}</span>
      )}
    </span>
  );
}
