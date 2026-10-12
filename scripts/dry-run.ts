// Live RSS -> prefilter -> Gemini -> score, printed only (no database writes).
// Run: npx tsx --conditions=react-server --env-file=.env.local scripts/dry-run.ts [limit]
import { DEFAULT_CONFIG } from "@/lib/config";
import { extract } from "@/lib/gemini";
import { prefilter } from "@/lib/prefilter";
import { fetchAllLanes } from "@/lib/rss";
import { scoreLead } from "@/lib/scoring";

const limit = Number(process.argv[2] ?? 20);
const { results, items } = await fetchAllLanes();
console.log(`feeds ok ${results.filter((r) => r.ok).length}/${results.length}, items ${results.reduce((n, r) => n + r.items.length, 0)}, unique ${items.length}`);
for (const r of results) console.log(`  ${r.lane.padEnd(18)} ${r.ok ? r.items.length : "FAILED " + r.error}`);
const passed = items.filter((i) => prefilter(i.title, i.snippet).pass);
console.log(`prefilter pass ${passed.length}/${items.length}; extracting ${Math.min(limit, passed.length)}\n`);

const rows: string[] = [];
const batch = passed.slice(0, limit);
const t0 = Date.now();
await Promise.all([0].map(async (w) => {
  for (let i = w; i < batch.length; i += 1) {
    const it = batch[i];
    try {
      const { extraction: ex, model } = await extract(it);
      if (!ex.relevant) { rows.push(`  -      irrelevant  ${it.title.slice(0, 80)}`); continue; }
      if (ex.is_policy) { rows.push(`  POLICY ${model.padEnd(16)} ${it.title.slice(0, 70)} | action: ${ex.policy_action}`); continue; }
      if (!ex.company_name || !ex.signal_type) { rows.push(`  -      no company   ${it.title.slice(0, 80)}`); continue; }
      const s = scoreLead({ ...ex, company_name: ex.company_name, signal_type: ex.signal_type, posted_at: it.published_at ?? new Date().toISOString(),
        csr_focus_area: ex.csr_focus_area === "Other" ? null : ex.csr_focus_area }, DEFAULT_CONFIG);
      rows.push(`  ${s.tier.toUpperCase().padEnd(5)}${String(s.priority_score).padStart(3)} ${ex.company_name.slice(0, 26).padEnd(26)} ${ex.signal_type.padEnd(16)} ${(ex.city ?? "-").slice(0, 14).padEnd(14)} poc=${ex.poc_name ?? "-"} partner=${(ex.implementation_partner ?? "-").slice(0, 24)} [${s.score_signal}/${s.score_recency}/${s.score_sector_fit}/${s.score_geo_fit}/${s.score_budget_fit}${s.hot_gate_fails.length ? " gates:" + s.hot_gate_fails.join(",") : ""}]${s.proven_funder ? " PROVEN" : ""}`);
    } catch (e) {
      rows.push(`  ERROR  ${(e as Error).message.slice(0, 120)}`);
    }
  }
}));
console.log(rows.sort().join("\n"));
console.log(`\n${batch.length} items in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
