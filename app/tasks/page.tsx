import Link from "next/link";
import { setTaskStatus } from "@/app/actions";
import { ActionButton } from "@/app/components/ActionButton";
import { CopyButton } from "@/app/components/CopyButton";
import { getTasks } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { isAdmin, showSample } from "@/lib/session";
import { CHANNEL_LABEL, TIER_STYLE } from "@/lib/ui";

export const dynamic = "force-dynamic";

type Task = Awaited<ReturnType<typeof getTasks>>[number];

export default async function Tasks() {
  const [all, admin, sample] = await Promise.all([getTasks(), isAdmin(), showSample()]);
  const tasks = all.filter((t: Task) => sample || !t.leads?.is_synthetic);
  const open = tasks.filter((t: Task) => t.status === "open");
  const closed = tasks.filter((t: Task) => t.status !== "open");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Tasks: {open.length} open</h1>
        <p className="mt-1 text-sm text-stone-600">Drafts are ready to copy. Nothing here is ever sent to a company.</p>
      </div>
      {open.length === 0 && <p className="text-sm text-stone-600">No open tasks. New hot leads get a call task automatically; any lead can get one from its drawer.</p>}
      {open.map((t: Task) => (
        <article key={t.id} className="rounded-lg bg-white p-4 ring-1 ring-stone-200">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">
              {t.leads && <span className={`mr-2 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${TIER_STYLE[t.leads.tier as "hot"].badge}`}>{t.leads.tier}</span>}
              {t.title}
            </h2>
            <span className="text-sm text-stone-600">Due {t.due_date ? formatDate(`${t.due_date}T09:00:00+05:30`) : "no date"}{t.outreach_channel ? ` · start with ${CHANNEL_LABEL[t.outreach_channel] ?? t.outreach_channel}` : ""}</span>
          </div>
          {t.email_draft ? (
            <div className="mt-3 space-y-2 text-sm">
              <p><span className="text-stone-500">Subject:</span> {t.email_subject}</p>
              <pre className="whitespace-pre-wrap rounded-md bg-stone-50 p-3 font-sans text-stone-800 ring-1 ring-stone-200">{t.email_draft}</pre>
              {t.call_opener && <p><span className="text-stone-500">Call opener:</span> {t.call_opener}</p>}
              <div className="flex flex-wrap gap-2">
                <CopyButton text={`Subject: ${t.email_subject}\n\n${t.email_draft}`} label="Copy email" />
                {t.call_opener && <CopyButton text={t.call_opener} label="Copy opener" />}
              </div>
              {t.drafted_model && <p className="text-xs text-stone-500">Drafted by {t.drafted_model}. Check names and numbers before sending.</p>}
            </div>
          ) : (
            <p className="mt-2 text-sm text-stone-600">No draft yet. Open the lead and use Draft email.</p>
          )}
          <div className="mt-3 flex flex-wrap items-start gap-2">
            {t.leads && <Link href={`/?lead=${t.leads.id}`} className="rounded-md px-3 py-1.5 text-sm ring-1 ring-stone-300">Open lead</Link>}
            <ActionButton action={setTaskStatus.bind(null, t.id, "done")} label="Mark done" disabled={!admin} />
            <ActionButton action={setTaskStatus.bind(null, t.id, "dropped")} label="Drop" variant="quiet" disabled={!admin} />
          </div>
        </article>
      ))}
      {closed.length > 0 && (
        <details className="text-sm text-stone-600">
          <summary className="cursor-pointer">{closed.length} done or dropped</summary>
          <ul className="mt-2 list-disc pl-5">{closed.map((t: Task) => <li key={t.id}>{t.title} ({t.status})</li>)}</ul>
        </details>
      )}
    </div>
  );
}
