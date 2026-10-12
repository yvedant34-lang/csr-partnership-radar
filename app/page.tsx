import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionChecklist } from "@/app/components/ActionChecklist";
import { Card, Kpi, TierBadge } from "@/app/components/Badges";
import { ConversionChart } from "@/app/components/ConversionChart";
import { CoverageStrip } from "@/app/components/CoverageStrip";
import { LeadsTable } from "@/app/components/LeadsTable";
import { getConfig, getConversionSeries, getCoverage, getLeads, type Lead } from "@/lib/data";
import { isAdmin, showSample } from "@/lib/session";
import { actionQueue, buildLeadViews, todayIst } from "@/lib/view";
import { isoWeek, thisWeekCutoff } from "@/lib/week";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function headline(hot: Lead[], warm: Lead[]): string {
  const names = (ls: Lead[]) => ls.slice(0, 2).map((l) => l.company_name).join(" and ");
  const call = hot.length ? `Call ${hot.length} this week: ${names(hot)}${hot.length > 2 ? " and others" : ""}.` : "No calls this week.";
  return warm.length ? `${call} Warm up ${names(warm)}${warm.length > 2 ? ` and ${warm.length - 2} more` : ""}.` : call;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead } = await searchParams;
  if (lead) redirect(`/leads/${lead}`); // links in older digests

  const sample = await showSample();
  const [leads, coverage, series, cfg, admin] = await Promise.all([
    getLeads({ sample }), getCoverage(), getConversionSeries(sample), getConfig(), isAdmin(),
  ]);
  const { rows, actions } = await buildLeadViews(leads, cfg);
  const cutoff = thisWeekCutoff().getTime();
  const thisWeek = leads.filter((l) => new Date(l.posted_at).getTime() >= cutoff);
  const hot = thisWeek.filter((l) => l.tier === "hot");
  const warm = thisWeek.filter((l) => l.tier === "warm");
  const open = leads.filter((l) => !["won", "lost", "parked"].includes(l.pipeline_stage));
  const queue = actionQueue(leads, actions, 10);
  const openActions = [...actions.values()].flat().filter((a) => !a.done && a.key !== "nurture").length;
  const avg = open.length ? open.reduce((n, l) => n + l.probability_of_conversion_pct, 0) / open.length : 0;
  const today = todayIst();

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-xs text-fg-3">{formatDate(new Date())} · Week {isoWeek().split("-W")[1]}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{headline(hot, warm)}</h1>
        <CoverageStrip run={coverage.run} queued={coverage.queued} />
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Call this week" value={hot.length} tone="hot" hint="Hot, posted in 7 days" />
        <Kpi label="Warm up" value={warm.length} tone="warm" hint="Email and LinkedIn" />
        <Kpi label="Open actions" value={openActions} hint="Across all leads" />
        <Kpi label="Leads in pipeline" value={open.length} hint={`${leads.length - open.length} closed or parked`} />
        <Kpi label="Avg conversion" value={`${avg.toFixed(1)}%`} hint="Estimate, not measured" />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Your actions" action={<Link href="/tasks" className="text-xs text-fg-3 hover:text-fg">All tasks</Link>}>
          <ActionChecklist items={queue} admin={admin} today={today} showCompany empty="No open actions. New signals arrive every morning at 05:00 IST." />
          {!admin && <p className="mt-3 text-xs text-fg-3"><Link href="/login" className="underline">Unlock editing</Link> to tick actions off and draft emails.</p>}
        </Card>
        <div className="space-y-4">
          <Card title="This week">
            <ul className="space-y-3 text-sm">
              {(["hot", "warm", "cold"] as const).map((tier) => {
                const ls = thisWeek.filter((l) => l.tier === tier);
                return (
                  <li key={tier}>
                    <div className="mb-1 flex items-center justify-between"><TierBadge tier={tier} /><span className="text-xs text-fg-3 tabular">{ls.length}</span></div>
                    <p className="text-fg-2">
                      {ls.length ? ls.slice(0, 4).map((l, i) => (
                        <span key={l.id}>{i > 0 && ", "}<Link href={`/leads/${l.id}`} className="hover:underline">{l.company_name}</Link></span>
                      )) : <span className="text-fg-3">None</span>}
                      {ls.length > 4 && <span className="text-fg-3"> and {ls.length - 4} more</span>}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title="Lead conversion" action={<Link href="/pipeline" className="text-xs text-fg-3 hover:text-fg">Pipeline</Link>}>
            <ConversionChart data={series} compact measuredAfter={cfg.conversion_prior.measured_after_outcomes} />
          </Card>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Top leads by score</h2>
          <Link href="/leads" className="text-xs text-fg-3 hover:text-fg">All {leads.length} leads</Link>
        </div>
        <LeadsTable rows={rows.slice(0, 8)} />
      </section>
    </div>
  );
}
