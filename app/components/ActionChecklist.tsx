"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { completeAction, draftEmail, findContactAction, revealEmailAction, type ActionResult } from "@/app/actions";
import type { NextAction } from "@/lib/next-actions";

export interface ChecklistItem extends NextAction {
  leadId: string;
  company?: string;
  tier?: "hot" | "warm" | "cold";
  sourceUrl?: string | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dueLabel(due: string | null, today: string): { text: string; overdue: boolean } | null {
  if (!due) return null;
  if (due === today) return { text: "Today", overdue: false };
  const d = new Date(`${due}T12:00:00+05:30`);
  return { text: `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`, overdue: due < today };
}

const CTA_LABEL = { draft: "Draft email", find_contact: "Find contact", reveal_email: "Reveal email", open_source: "Open source" } as const;

function Cta({ item, admin }: { item: ChecklistItem; admin: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult | null>(null);
  if (!item.cta) return null;
  if (item.cta === "open_source") {
    return item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 text-xs text-fg-2 hover:text-fg">Open source</a> : null;
  }
  const run = () => start(async () => {
    const r = item.cta === "draft" ? await draftEmail(item.leadId)
      : item.cta === "find_contact" ? await findContactAction(item.leadId)
      : await revealEmailAction(item.contactId!);
    setMsg(r);
  });
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button type="button" onClick={run} disabled={!admin || pending}
        className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-fg disabled:cursor-not-allowed disabled:opacity-40">
        {pending ? "Working…" : CTA_LABEL[item.cta]}
      </button>
      {msg && <span className={`text-[11px] ${msg.ok ? "text-fg-3" : "text-hot"}`}>{msg.message}</span>}
    </span>
  );
}

export function ActionChecklist({ items, admin, today, showCompany = false, empty = "Nothing to do." }: {
  items: ChecklistItem[]; admin: boolean; today: string; showCompany?: boolean; empty?: string;
}) {
  const [optimistic, setDone] = useOptimistic(items, (state, change: { key: string; leadId: string; done: boolean }) =>
    state.map((i) => (i.key === change.key && i.leadId === change.leadId ? { ...i, done: change.done } : i)));
  const [, start] = useTransition();
  if (!optimistic.length) return <p className="text-sm text-fg-3">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {optimistic.map((i) => {
        const due = dueLabel(i.due, today);
        return (
          <li key={`${i.leadId}-${i.key}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <input
              type="checkbox"
              checked={i.done}
              disabled={!admin}
              aria-label={`Mark "${i.title}" done`}
              onChange={(e) => {
                const done = e.target.checked;
                start(async () => {
                  setDone({ key: i.key, leadId: i.leadId, done });
                  await completeAction(i.leadId, i.key, i.title, done);
                });
              }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-current disabled:cursor-not-allowed"
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${i.done ? "text-fg-3 line-through" : "text-fg"}`}>
                {i.title}
                {showCompany && i.company && (
                  <> · <Link href={`/leads/${i.leadId}`} className="font-medium underline-offset-2 hover:underline">{i.company}</Link></>
                )}
              </p>
              <p className="mt-0.5 text-xs text-fg-3">{i.why}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {due && <span className={`text-xs tabular ${due.overdue && !i.done ? "text-hot" : "text-fg-3"}`}>{due.overdue && !i.done ? `Overdue · ${due.text}` : due.text}</span>}
              {!i.done && <Cta item={i} admin={admin} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
