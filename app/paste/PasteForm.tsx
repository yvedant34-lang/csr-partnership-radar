"use client";

import Link from "next/link";
import { useActionState } from "react";
import { pasteAction } from "@/app/actions";

export function PasteForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(pasteAction, null);
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium">Link</span>
        <input name="url" type="url" placeholder="https://… (news article, company CSR page, LinkedIn post)" className="mt-1 w-full rounded-xl bg-surface-2 px-4 py-2.5 border border-line" />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Post or message text</span>
        <span className="block text-xs text-fg-3">Required for LinkedIn and WhatsApp forwards. LinkedIn pages are never fetched.</span>
        <textarea name="text" rows={8} className="mt-1 w-full rounded-xl bg-surface-2 px-4 py-2.5 border border-line" />
      </label>
      <button disabled={disabled || pending} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-fg disabled:opacity-50">
        {pending ? "Reading and scoring…" : "Read and score"}
      </button>
      {state && (
        <p role="status" className={`text-sm ${state.ok ? "text-fg" : "text-hot"}`}>
          {state.message}{" "}
          {"leadId" in state && state.leadId && <Link href={`/leads/${state.leadId}`} className="underline">Open the lead</Link>}
        </p>
      )}
    </form>
  );
}
