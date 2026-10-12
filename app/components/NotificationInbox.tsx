import Link from "next/link";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions";
import { ActionButton } from "@/app/components/ActionButton";
import { ActionChecklist } from "@/app/components/ActionChecklist";
import { TierBadge } from "@/app/components/Badges";
import type { Lead, Notification } from "@/lib/data";
import type { NextAction } from "@/lib/next-actions";

const SOURCE_LABEL: Record<string, string> = { news: "News", paste: "Pasted", linkedin: "LinkedIn", inbound: "Live feed" };

function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
}

/** New signals from any source, each with that lead's next actions as checkboxes. */
export function NotificationInbox({ items, leads, actions, admin, today }: {
  items: Notification[]; leads: Map<string, Lead>; actions: Map<string, NextAction[]>; admin: boolean; today: string;
}) {
  // Hot and warm (and anything that just moved up) get the full card with checkboxes; cold is watch only.
  const rank = (n: Notification) => ({ hot: 0, warm: 1 } as Record<string, number>)[n.tier ?? ""] ?? 2;
  const sorted = [...items].sort((a, b) => rank(a) - rank(b) || +new Date(b.created_at) - +new Date(a.created_at));
  const act = sorted.filter((n) => rank(n) < 2 || n.kind === "tier_up");
  const watch = sorted.filter((n) => !act.includes(n));
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            {items.length > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-2 opacity-60" />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${items.length ? "bg-accent-2" : "bg-fg-3"}`} />
          </span>
          <h2 className="label">New signals</h2>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular text-fg-2">{items.length}</span>
        </div>
        {items.length > 0 && <ActionButton size="sm" variant="quiet" action={markAllNotificationsRead} label="Clear all" disabled={!admin} />}
      </header>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-fg-3">You are up to date. New posts and news land here with their next steps, from the morning run, Paste a link, or the live feed.</p>
      ) : (
        <>
        <ul className="divide-y divide-line">
          {act.length === 0 && <li className="px-5 py-4 text-sm text-fg-3">No new hot or warm signals. Cold ones are listed below for awareness.</li>}
          {act.map((n) => {
            const lead = n.lead_id ? leads.get(n.lead_id) : undefined;
            const todo = lead ? (actions.get(lead.id) ?? []).filter((a) => a.key !== "nurture").slice(0, 3) : [];
            return (
              <li key={n.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {n.tier && <TierBadge tier={n.tier as "hot"} score={lead?.priority_score} />}
                      <span className="text-[11px] uppercase tracking-wider text-fg-3">{SOURCE_LABEL[n.source ?? ""] ?? n.source} · {ago(n.created_at)}</span>
                    </div>
                    <p className="font-medium text-fg">{n.title}</p>
                    {n.body && <p className="text-sm text-fg-2">{n.body}</p>}
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    {lead && <Link href={`/leads/${lead.id}`} className="pill">Open lead</Link>}
                    <ActionButton size="sm" action={markNotificationRead.bind(null, n.id)} label="Clear" disabled={!admin} />
                  </div>
                </div>
                {lead && todo.length > 0 && (
                  <div className="mt-3 rounded-xl bg-surface-2 p-3">
                    <p className="label mb-2">Next to do</p>
                    <ActionChecklist items={todo.map((a) => ({ ...a, leadId: lead.id, sourceUrl: lead.source_url ?? lead.post_link }))} admin={admin} today={today} />
                  </div>
                )}
                {lead && todo.length === 0 && <p className="mt-2 text-xs text-fg-3">No outreach now: {lead.tier} lead kept on the nurture list.</p>}
              </li>
            );
          })}
        </ul>
        {watch.length > 0 && (
          <div className="border-t border-line px-5 py-3">
            <p className="label mb-2">Watch only · no outreach now</p>
            <ul className="space-y-1.5">
              {watch.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-fg-2">
                    {n.lead_id ? <Link href={`/leads/${n.lead_id}`} className="hover:text-fg hover:underline">{n.title}</Link> : n.title}
                    <span className="text-fg-3"> · {ago(n.created_at)}</span>
                  </span>
                  <ActionButton size="sm" variant="quiet" action={markNotificationRead.bind(null, n.id)} label="Clear" disabled={!admin} />
                </li>
              ))}
            </ul>
          </div>
        )}
        </>
      )}
    </section>
  );
}
