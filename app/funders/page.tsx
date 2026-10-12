import { redirect } from "next/navigation";
import { LeadsTable } from "@/app/components/LeadsTable";
import { getConfig, getLeads } from "@/lib/data";
import { showSample } from "@/lib/session";
import { buildLeadViews } from "@/lib/view";
import { isActionPlanSeason } from "@/lib/week";
import { nextFy } from "@/lib/next-actions";

export const dynamic = "force-dynamic";

export default async function Funders({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead } = await searchParams;
  if (lead) redirect(`/leads/${lead}`);
  const sample = await showSample();
  const [leads, cfg] = await Promise.all([getLeads({ sample, provenOnly: true }), getConfig()]);
  // Next-cycle pitching order: closest to home first, then best sector fit, then most recent.
  const sorted = [...leads].sort((a, b) =>
    b.score_geo_fit - a.score_geo_fit || b.score_sector_fit - a.score_sector_fit || +new Date(b.posted_at) - +new Date(a.posted_at));
  const { rows } = await buildLeadViews(sorted, cfg);
  const season = isActionPlanSeason();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proven funders</h1>
        <p className="text-sm text-fg-3">{sorted.length} companies already funding our kind of work in our footprint. This year&apos;s partner is set: pitch for {nextFy(new Date())}.</p>
      </div>
      <div className={`rounded-lg border px-4 py-3 text-sm ${season ? "border-warm bg-warm-bg text-warm" : "border-line bg-surface text-fg-2"}`}>
        {season
          ? "It is January to March: boards are approving next year's CSR action plans now. Pitch this week."
          : "January to March is when boards approve next year's CSR action plans. Get proposals in before January."}
      </div>
      <LeadsTable rows={rows} />
    </div>
  );
}
