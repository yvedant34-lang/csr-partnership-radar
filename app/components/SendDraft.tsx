"use client";

import { useMemo, useState, useTransition } from "react";
import { markEmailSent } from "@/app/actions";
import { composeLinks } from "@/lib/compose";
import { meetingAsk, nextDaySlot, withMeetingAsk } from "@/lib/meeting";

export interface MeetingPrefs { hour: number; minutes: number; skipWeekends: boolean; schedulingUrl: string | null }

/** Opens the user's own mailbox with the draft filled in. The meeting ask (3 pm IST the next day) is
 *  worked out at the moment of sending. Nothing is sent by the radar. */
export function SendDraft({ leadId, to, toName, subject, body, admin, meeting }: {
  leadId: string; to: string | null; toName: string | null; subject: string; body: string; admin: boolean; meeting: MeetingPrefs;
}) {
  const [opened, setOpened] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const { links, ask } = useMemo(() => {
    const now = new Date();
    const slot = nextDaySlot(now, meeting.hour, meeting.skipWeekends);
    const ask = meetingAsk(slot, { minutes: meeting.minutes, schedulingUrl: meeting.schedulingUrl, from: now });
    return { ask, links: composeLinks({ to: admin ? to : null, subject, body: withMeetingAsk(body, ask) }) };
  }, [admin, to, subject, body, meeting]);
  const btn = "rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-fg hover:bg-surface-2";
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <p className="text-xs text-fg-3">
        Send from your own account{to && admin ? ` to ${toName ?? to} (${to})` : to ? " (unlock to fill in the recipient)" : ": no email on file, add the recipient yourself"}.
      </p>
      <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-2"><span className="label mr-1.5">Meeting ask</span>{ask}</p>
      <div className="flex flex-wrap items-center gap-2">
        <a href={links.gmail} target="_blank" rel="noreferrer" onClick={() => setOpened(true)} className={btn}>Open in Gmail</a>
        <a href={links.outlook} target="_blank" rel="noreferrer" onClick={() => setOpened(true)} className={btn}>Open in Outlook</a>
        <a href={links.mailto} onClick={() => setOpened(true)} className={btn}>Open in mail app</a>
        {(opened || admin) && (
          <button type="button" disabled={!admin || pending}
            onClick={() => start(async () => setMsg((await markEmailSent(leadId, to, toName)).message))}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-fg disabled:opacity-40">
            {pending ? "Saving…" : "I sent it"}
          </button>
        )}
      </div>
      {msg && <p role="status" className="text-xs text-fg-3">{msg}</p>}
    </div>
  );
}
