"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-fg-2 hover:bg-surface-2 hover:text-fg"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
