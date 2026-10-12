import Link from "next/link";
import { SampleBadge, StageBadge, TierBadge } from "@/app/components/Badges";
import type { Lead } from "@/lib/data";
import { formatShortDate } from "@/lib/format";
import type { NextAction } from "@/lib/next-actions";
import { place, SIGNAL_LABEL } from "@/lib/ui";

export interface LeadRow { lead: Lead; next: NextAction | null; contact: string | null; confidence: string }

/** HubSpot-style records table. On phones each row collapses to a two-line card. */
export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-fg-3">No leads match these filters.</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="hidden border-b border-line bg-surface-2 text-xs text-fg-3 md:table-header-group">
          <tr>
            <th className="px-3 py-2 font-medium">Company</th>
            <th className="px-3 py-2 font-medium">Tier</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Next action</th>
            <th className="hidden px-3 py-2 font-medium lg:table-cell">Contact</th>
            <th className="px-3 py-2 text-right font-medium">Estimate</th>
            <th className="hidden px-3 py-2 text-right font-medium lg:table-cell">Posted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(({ lead: l, next, contact, confidence }) => (
            <tr key={l.id} className="block px-3 py-2.5 hover:bg-surface-2 md:table-row md:px-0 md:py-0">
              <td className="block md:table-cell md:px-3 md:py-2.5">
                <Link href={`/leads/${l.id}`} className="font-medium text-fg hover:underline">{l.company_name}</Link>
                {l.is_synthetic && <> <SampleBadge /></>}
                <p className="text-xs text-fg-3">{SIGNAL_LABEL[l.signal_type] ?? l.signal_type} · {place(l)}{l.proven_funder ? " · Proven funder" : ""}</p>
              </td>
              <td className="inline-block pr-2 pt-1 md:table-cell md:px-3 md:py-2.5"><TierBadge tier={l.tier} score={l.priority_score} /></td>
              <td className="inline-block pr-2 pt-1 md:table-cell md:px-3 md:py-2.5"><StageBadge stage={l.pipeline_stage} /></td>
              <td className="block pt-1 text-fg-2 md:table-cell md:px-3 md:py-2.5">
                {next ? <span className={next.done ? "line-through text-fg-3" : ""}>{next.title}</span> : <span className="text-fg-3">None</span>}
              </td>
              <td className="hidden px-3 py-2.5 text-fg-2 lg:table-cell">{contact ?? <span className="text-fg-3">Not published</span>}</td>
              <td className="inline-block pt-1 text-xs text-fg-3 md:table-cell md:px-3 md:py-2.5 md:text-right md:text-sm">
                <span className="tabular text-fg">{l.probability_of_conversion_pct.toFixed(1)}%</span> <span className="text-xs text-fg-3">{confidence}</span>
              </td>
              <td className="hidden px-3 py-2.5 text-right text-xs text-fg-3 lg:table-cell">{formatShortDate(l.posted_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
