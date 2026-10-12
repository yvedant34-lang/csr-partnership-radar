import { ConversionChart } from "@/app/components/ConversionChart";
import { CoverageStrip } from "@/app/components/CoverageStrip";
import { LeadCard } from "@/app/components/LeadCard";
import { LeadDrawer } from "@/app/components/LeadDrawer";
import { getConfig, getConversionSeries, getCoverage, getLeads, type Lead } from "@/lib/data";
import { isAdmin, showSample } from "@/lib/session";
import { TIER_STYLE } from "@/lib/ui";

export const dynamic = "force-dynamic";

function headline(hot: Lead[], warm: Lead[]): string {
  const names = (ls: Lead[]) => ls.slice(0, 2).map((l) => l.company_name).join(" and ");
  const call = hot.length ? `Call ${hot.length} this week: ${names(hot)}${hot.length > 2 ? " and others" : ""}.` : "No calls this week.";
  const warmUp = warm.length ? ` Warm up ${names(warm)}${warm.length > 2 ? ` and ${warm.length - 2} more` : ""}.` : "";
  return call + warmUp;
}

export default async function ThisWeek({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: openLead } = await searchParams;
  const sample = await showSample();
  const [leads, coverage, series, cfg, admin] = await Promise.all([
    getLeads({ sample, thisWeek: true }), getCoverage(), getConversionSeries(sample), getConfig(), isAdmin(),
  ]);
  const by = { hot: leads.filter((l) => l.tier === "hot"), warm: leads.filter((l) => l.tier === "warm"), cold: leads.filter((l) => l.tier === "cold") };

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-xl font-semibold text-stone-900">{headline(by.hot, by.warm)}</h1>
        {by.hot.length === 0 && (
          <p className="mt-1 text-sm text-stone-600">Explicit &quot;we need an NGO partner&quot; posts usually live on LinkedIn: paste any you have seen.</p>
        )}
        <div className="mt-2"><CoverageStrip run={coverage.run} queued={coverage.queued} /></div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {(["hot", "warm", "cold"] as const).map((tier) => (
          <div key={tier} className="min-w-0 space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <span className={`inline-block h-2 w-2 rounded-full ${TIER_STYLE[tier].dot}`} aria-hidden />
              {TIER_STYLE[tier].label}: {TIER_STYLE[tier].column}
              <span className="rounded-full bg-stone-200 px-2 text-xs tabular-nums text-stone-700">{by[tier].length}</span>
            </h2>
            {by[tier].length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-300 p-3 text-sm text-stone-500">
                {tier === "hot" ? "Nothing passed the hot rules this week." : "None this week."}
              </p>
            ) : (
              by[tier].map((l) => <LeadCard key={l.id} lead={l} basePath="/" />)
            )}
          </div>
        ))}
      </section>

      <section className="rounded-lg bg-white p-4 ring-1 ring-stone-200">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Lead conversion, last 12 weeks</h2>
          <a href="/pipeline" className="text-xs text-stone-600 underline">Open pipeline</a>
        </div>
        <ConversionChart data={series} compact measuredAfter={cfg.conversion_prior.measured_after_outcomes} />
      </section>

      <p className="text-xs text-stone-500">This week means posted in the last 7 days, worked out when the page loads. Older leads stay in the pipeline and Proven funders.</p>

      {openLead && <LeadDrawer id={openLead} basePath="/" admin={admin} cfg={cfg} />}
    </div>
  );
}
