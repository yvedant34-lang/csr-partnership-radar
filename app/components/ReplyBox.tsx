"use client";

import { useActionState } from "react";
import { logReply } from "@/app/actions";

/** Paste the lead's reply. A clear yes (or a clear new time) books on Calendly; anything else waits for you. */
export function ReplyBox({ leadId, admin }: { leadId: string; admin: boolean }) {
  const [state, action, pending] = useActionState(logReply.bind(null, leadId), null);
  return (
    <form action={action} className="space-y-2">
      <textarea name="reply" rows={3} disabled={!admin} placeholder="Paste their reply, for example: Yes, 3 pm tomorrow works for me."
        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm placeholder:text-fg-3 disabled:opacity-50" />
      <div className="flex flex-wrap items-center gap-2">
        <input name="from" type="email" disabled={!admin} placeholder="Their email (optional)"
          className="w-56 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs placeholder:text-fg-3 disabled:opacity-50" />
        <button disabled={!admin || pending} className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-accent-fg disabled:opacity-40">
          {pending ? "Reading the reply…" : "Read reply"}
        </button>
      </div>
      {state && <p role="status" className={`text-xs ${state.ok ? "text-fg-2" : "text-hot"}`}>{state.message}</p>}
    </form>
  );
}
