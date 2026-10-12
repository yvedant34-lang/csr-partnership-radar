import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, SampleBadge } from "@/app/components/Badges";
import { ConversionChart } from "@/app/components/ConversionChart";
import { StageSelect } from "@/app/components/StageSelect";
import { getConfig, getConversionSeries, getLeads, STAGES } from "@/lib/data";
import { isAdmin, showSample } from "@/lib/session";
import { STAGE_LABEL, TIER_STYLE } from "@/lib/ui";
import { buildLeadViews } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead } = await searchParams;
  if (lead) redirect(`/leads/${lead}`);
  const sample = await showSample();
  const [leads, series, cfg, admin] = await Promise.all([getLeads({ sample }), getConversionSeries(sample), getConfig(), isAdmin()]);
  const { actions } = await buildLeadViews(leads, cfg);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-fg-3">Every lead by stage, with its next action. Move a card with its stage menu.</p>
      </div>
      <Card title="Lead conversion: leads entering each stage per week">
        <ConversionChart data={series} measuredAfter={cfg.conversion_prior.measured_after_outcomes} />
      </Card>
      <section className="-mx-4 overflow-x-auto px-4 md:-mx-8 md:px-8">
        <div className="grid min-w-[1120px] grid-cols-7 gap-3">
          {STAGES.map((stage) => {
            const col = leads.filter((l) => l.pipeline_stage === stage);
            return (
              <div key={stage} className="space-y-2 rounded-lg bg-surface-2 p-2">
                <h2 className="flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-fg-2">
                  {STAGE_LABEL[stage]} <span className="tabular font-normal text-fg-3">{col.length}</span>
                </h2>
                {col.map((l) => {
                  const next = (actions.get(l.id) ?? []).find((a) => !a.done);
                  return (
                    <div key={l.id} className="space-y-1.5 rounded-md border border-line bg-surface p-2.5 text-sm">
                      <Link href={`/leads/${l.id}`} className="block">
                        <span className="flex items-center gap-1.5">
                          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${TIER_STYLE[l.tier].dot}`} aria-label={TIER_STYLE[l.tier].label} />
                          <span className="truncate font-medium hover:underline">{l.company_name}</span>
                        </span>
                        <span className="block text-xs text-fg-3">{TIER_STYLE[l.tier].label} {l.priority_score} · est. {l.probability_of_conversion_pct.toFixed(1)}%</span>
                        {next && <span className="mt-1 block text-xs text-fg-2">Next: {next.title}</span>}
                        {l.is_synthetic && <SampleBadge />}
                      </Link>
                      {admin && <StageSelect leadId={l.id} stage={l.pipeline_stage} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
