import { LeadCard } from "@/app/components/LeadCard";
import { LeadDrawer } from "@/app/components/LeadDrawer";
import { getConfig, getLeads } from "@/lib/data";
import { isAdmin, showSample } from "@/lib/session";
import { isActionPlanSeason } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function Funders({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: openLead } = await searchParams;
  const sample = await showSample();
  const [leads, cfg, admin] = await Promise.all([getLeads({ sample, provenOnly: true }), getConfig(), isAdmin()]);
  // Next-cycle pitching order: closest to home first, then best sector fit, then most recent.
  const sorted = [...leads].sort((a, b) =>
    b.score_geo_fit - a.score_geo_fit || b.score_sector_fit - a.score_sector_fit || +new Date(b.posted_at) - +new Date(a.posted_at));
  const season = isActionPlanSeason();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Proven funders: {sorted.length} to pitch for next cycle</h1>
        <p className="mt-1 text-sm text-stone-600">Companies already funding our kind of work in our footprint, through a partner. This year&apos;s partner is set; the pitch is for next year.</p>
      </div>
      <div className={`rounded-lg px-4 py-3 text-sm ring-1 ${season ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-white text-stone-700 ring-stone-200"}`}>
        {season
          ? "It is January to March: boards are approving next year's CSR action plans now. Pitch this week."
          : "January to March is when boards approve next year's CSR action plans. Get proposals in front of these companies before January."}
      </div>
      <div className="grid gap-2 md:grid-cols-2 [&>*]:min-w-0">
        {sorted.map((l) => <LeadCard key={l.id} lead={l} basePath="/funders" />)}
      </div>
      {openLead && <LeadDrawer id={openLead} basePath="/funders" admin={admin} cfg={cfg} />}
    </div>
  );
}
