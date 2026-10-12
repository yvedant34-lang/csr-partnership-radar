import Link from "next/link";
import { ConversionChart } from "@/app/components/ConversionChart";
import { LeadDrawer } from "@/app/components/LeadDrawer";
import { StageSelect } from "@/app/components/StageSelect";
import { getConfig, getConversionSeries, getLeads, STAGES } from "@/lib/data";
import { isAdmin, showSample } from "@/lib/session";
import { STAGE_LABEL, TIER_STYLE, withParam } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: openLead } = await searchParams;
  const sample = await showSample();
  const [leads, series, cfg, admin] = await Promise.all([getLeads({ sample }), getConversionSeries(sample), getConfig(), isAdmin()]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Pipeline</h1>
      <section className="rounded-lg bg-white p-4 ring-1 ring-stone-200">
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Lead conversion: leads entering each stage per week</h2>
        <ConversionChart data={series} measuredAfter={cfg.conversion_prior.measured_after_outcomes} />
      </section>
      <section className="-mx-4 overflow-x-auto px-4">
        <div className="grid min-w-[1050px] grid-cols-7 gap-3">
          {STAGES.map((stage) => {
            const col = leads.filter((l) => l.pipeline_stage === stage);
            return (
              <div key={stage} className="space-y-2">
                <h2 className="text-sm font-semibold text-stone-700">{STAGE_LABEL[stage]} <span className="text-xs font-normal text-stone-500">{col.length}</span></h2>
                {col.map((l) => (
                  <div key={l.id} className="rounded-lg bg-white p-2.5 text-sm ring-1 ring-stone-200">
                    <Link href={withParam("/pipeline", "lead", l.id)} scroll={false} className="block">
                      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${TIER_STYLE[l.tier].dot}`} aria-label={TIER_STYLE[l.tier].label} />
                      <span className="font-medium">{l.company_name}</span>
                      <span className="block text-xs text-stone-500">{TIER_STYLE[l.tier].label} {l.priority_score} · est. {l.probability_of_conversion_pct.toFixed(1)}%</span>
                      {l.is_synthetic && <span className="text-xs text-violet-700">Sample</span>}
                    </Link>
                    {admin && <div className="mt-1.5"><StageSelect leadId={l.id} stage={l.pipeline_stage} /></div>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>
      {openLead && <LeadDrawer id={openLead} basePath="/pipeline" admin={admin} cfg={cfg} />}
    </div>
  );
}
