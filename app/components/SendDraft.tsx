"use client";

import { useState, useTransition } from "react";
import { markEmailSent } from "@/app/actions";
import { composeLinks } from "@/lib/compose";

/** Opens the user's own mailbox with the draft filled in. Nothing is sent by the radar. */
export function SendDraft({ leadId, to, toName, subject, body, admin }: {
  leadId: string; to: string | null; toName: string | null; subject: string; body: string; admin: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const links = composeLinks({ to: admin ? to : null, subject, body });
  const btn = "rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg hover:bg-surface-2";
  return (
    <div className="space-y-1.5 rounded-md border border-line p-2.5">
      <p className="text-xs text-fg-3">
        Send from your own account{to && admin ? ` to ${toName ?? to} (${to})` : to ? " (unlock to fill in the recipient)" : ": no email on file, add the recipient yourself"}:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a href={links.gmail} target="_blank" rel="noreferrer" onClick={() => setOpened(true)} className={btn}>Open in Gmail</a>
        <a href={links.outlook} target="_blank" rel="noreferrer" onClick={() => setOpened(true)} className={btn}>Open in Outlook</a>
        <a href={links.mailto} onClick={() => setOpened(true)} className={btn}>Open in mail app</a>
        {(opened || admin) && (
          <button type="button" disabled={!admin || pending}
            onClick={() => start(async () => setMsg((await markEmailSent(leadId)).message))}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg disabled:opacity-40">
            {pending ? "Saving…" : "I sent it"}
          </button>
        )}
      </div>
      {msg && <p role="status" className="text-xs text-fg-3">{msg}</p>}
    </div>
  );
}
