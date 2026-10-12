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
      className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
