import Link from "next/link";
import type { Lead } from "@/lib/data";
import { formatShortDate } from "@/lib/format";
import { estimateConfidence } from "@/lib/scoring";
import { decision, place, SIGNAL_LABEL, TIER_STYLE, withParam } from "@/lib/ui";

/** Three lines, decision first. Everything else lives in the drawer. */
export function LeadCard({ lead, basePath }: { lead: Lead; basePath: string }) {
  const t = TIER_STYLE[lead.tier];
  const conf = estimateConfidence({ ...lead, has_contact_email: false });
  return (
    <Link
      href={withParam(basePath, "lead", lead.id)}
      scroll={false}
      className="block rounded-lg bg-white p-3 ring-1 ring-stone-200 transition hover:ring-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-700"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate">
          <span className={`mr-2 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${t.badge}`}>{t.label} {lead.priority_score}</span>
          <span className="font-semibold text-stone-900">{lead.company_name}</span>
        </div>
        <span className="shrink-0 text-xs text-stone-500">{formatShortDate(lead.posted_at)}</span>
      </div>
      <p className="mt-1.5 text-sm text-stone-800">
        <span className="font-medium">{decision(lead.tier)}</span>{" "}
        <span className="text-stone-600">{lead.why_now}</span>
      </p>
      <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-stone-500">
        <span>{SIGNAL_LABEL[lead.signal_type] ?? lead.signal_type}</span>
        <span>·</span><span>{place(lead)}</span>
        <span>·</span><span>{lead.poc_name ?? "Contact not published"}</span>
        <span>·</span><span>estimate {lead.probability_of_conversion_pct.toFixed(1)}% ({conf.level})</span>
        {lead.proven_funder && <><span>·</span><span className="text-stone-700">Proven funder</span></>}
        {!lead.article_read && <><span>·</span><span>headline only</span></>}
        {lead.is_synthetic && <span className="rounded bg-violet-50 px-1 text-violet-700 ring-1 ring-violet-200">Sample</span>}
      </p>
    </Link>
  );
}
