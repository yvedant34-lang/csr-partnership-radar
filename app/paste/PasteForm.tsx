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
        <input name="url" type="url" placeholder="https://… (news article, company CSR page, LinkedIn post)" className="mt-1 w-full rounded-md bg-white px-3 py-2 ring-1 ring-stone-300" />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Post or message text</span>
        <span className="block text-xs text-stone-500">Required for LinkedIn and WhatsApp forwards. LinkedIn pages are never fetched.</span>
        <textarea name="text" rows={8} className="mt-1 w-full rounded-md bg-white px-3 py-2 ring-1 ring-stone-300" />
      </label>
      <button disabled={disabled || pending} className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Reading and scoring…" : "Read and score"}
      </button>
      {state && (
        <p role="status" className={`text-sm ${state.ok ? "text-stone-800" : "text-red-700"}`}>
          {state.message}{" "}
          {"leadId" in state && state.leadId && <Link href={`/?lead=${state.leadId}`} className="underline">Open the lead</Link>}
        </p>
      )}
    </form>
  );
}
