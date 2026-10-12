import Link from "next/link";
import { LeadsTable } from "@/app/components/LeadsTable";
import { getConfig, getLeads, STAGES } from "@/lib/data";
import { showSample } from "@/lib/session";
import { STAGE_LABEL } from "@/lib/ui";
import { buildLeadViews } from "@/lib/view";
import { thisWeekCutoff } from "@/lib/week";

export const dynamic = "force-dynamic";

type Params = { tier?: string; stage?: string; week?: string; q?: string; sort?: string };

function href(cur: Params, patch: Partial<Params>) {
  const p = new URLSearchParams(Object.entries({ ...cur, ...patch }).filter(([, v]) => v && v !== "all") as [string, string][]);
  const s = p.toString();
  return s ? `/leads?${s}` : "/leads";
}

function Chip({ on, to, children }: { on: boolean; to: string; children: React.ReactNode }) {
  return (
    <Link href={to} className={`rounded-full px-2.5 py-1 text-xs ${on ? "bg-accent text-accent-fg" : "border border-line text-fg-2 hover:text-fg"}`}>{children}</Link>
  );
}

export default async function Leads({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const sample = await showSample();
  const [all, cfg] = await Promise.all([getLeads({ sample }), getConfig()]);
  const q = sp.q?.trim().toLowerCase();
  const cutoff = thisWeekCutoff().getTime();
  let leads = all
    .filter((l) => !sp.tier || sp.tier === "all" || l.tier === sp.tier)
    .filter((l) => !sp.stage || sp.stage === "all" || l.pipeline_stage === sp.stage)
    .filter((l) => sp.week !== "1" || new Date(l.posted_at).getTime() >= cutoff)
    .filter((l) => !q || `${l.company_name} ${l.city ?? ""} ${l.state ?? ""} ${l.poc_name ?? ""} ${l.summary ?? ""}`.toLowerCase().includes(q));
  if (sp.sort === "posted") leads = [...leads].sort((a, b) => +new Date(b.posted_at) - +new Date(a.posted_at));
  if (sp.sort === "estimate") leads = [...leads].sort((a, b) => b.probability_of_conversion_pct - a.probability_of_conversion_pct);
  const { rows } = await buildLeadViews(leads, cfg);
  const count = (tier: string) => all.filter((l) => l.tier === tier).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-fg-3">{rows.length} of {all.length} · scored by fixed rules, newest signals every morning</p>
        </div>
        <form action="/leads" className="flex gap-2">
          {Object.entries(sp).filter(([k, v]) => k !== "q" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input name="q" defaultValue={sp.q} placeholder="Search company, place, contact" className="w-56 rounded-full border border-line bg-surface px-2.5 py-1.5 text-sm placeholder:text-fg-3" />
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip on={!sp.tier || sp.tier === "all"} to={href(sp, { tier: "all" })}>All {all.length}</Chip>
        <Chip on={sp.tier === "hot"} to={href(sp, { tier: "hot" })}>Hot {count("hot")}</Chip>
        <Chip on={sp.tier === "warm"} to={href(sp, { tier: "warm" })}>Warm {count("warm")}</Chip>
        <Chip on={sp.tier === "cold"} to={href(sp, { tier: "cold" })}>Cold {count("cold")}</Chip>
        <span className="mx-1 h-4 w-px bg-line" />
        <Chip on={sp.week === "1"} to={href(sp, { week: sp.week === "1" ? "" : "1" })}>This week only</Chip>
        <span className="mx-1 h-4 w-px bg-line" />
        <Chip on={!sp.stage || sp.stage === "all"} to={href(sp, { stage: "all" })}>Any stage</Chip>
        {STAGES.map((s) => <Chip key={s} on={sp.stage === s} to={href(sp, { stage: s })}>{STAGE_LABEL[s]}</Chip>)}
        <span className="ml-auto text-xs text-fg-3">
          Sort:{" "}
          {[["", "score"], ["posted", "newest"], ["estimate", "estimate"]].map(([v, label]) => (
            <Link key={label} href={href(sp, { sort: v })} className={`ml-1.5 ${((sp.sort ?? "") === v) ? "text-fg underline" : "hover:text-fg"}`}>{label}</Link>
          ))}
        </span>
      </div>

      <LeadsTable rows={rows} />
    </div>
  );
}
