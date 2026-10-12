import "server-only";
import { prefilter } from "@/lib/prefilter";
import { loadConfig, processItem, rescoreAll } from "@/lib/pipeline";
import { fetchAllLanes, QUERIES } from "@/lib/rss";
import { db } from "@/lib/supabase/server";

export const EXTRACT_BATCH = 20;

/** Fetch every lane, dedupe, store new items. Gemini runs separately in extractBatch. */
export async function ingest() {
  const { data: run, error } = await db().from("ingestion_runs")
    .insert({ kind: "ingest", feeds_total: Object.keys(QUERIES).length }).select("id").single();
  if (error) throw new Error(`ingestion_runs: ${error.message}`);

  const { results, items } = await fetchAllLanes();
  const failed = results.filter((r) => !r.ok);
  const rows = items.map((it) => {
    const pf = prefilter(it.title, it.snippet);
    return {
      run_id: run.id, lane: it.lane, title: it.title, title_norm: it.title_norm, link: it.link,
      source_name: it.source_name, snippet: it.snippet, published_at: it.published_at,
      prefilter_pass: pf.pass, status: pf.pass ? "new" : "skipped", error: pf.pass ? null : pf.reason,
    };
  });
  // title_norm is unique: items seen on an earlier day are ignored, not re-extracted.
  const { data: inserted, error: insErr } = await db().from("raw_items")
    .upsert(rows, { onConflict: "title_norm", ignoreDuplicates: true }).select("id, prefilter_pass");
  if (insErr) throw new Error(`raw_items: ${insErr.message}`);

  // Prefilter rules change over time: give recently skipped items another look (plain code, no Gemini).
  const since = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const { data: skipped } = await db().from("raw_items").select("id, title, snippet")
    .eq("status", "skipped").gte("fetched_at", since);
  const revived = (skipped ?? []).filter((r) => prefilter(r.title, r.snippet).pass).map((r) => r.id);
  if (revived.length) {
    await db().from("raw_items").update({ status: "new", prefilter_pass: true, error: null }).in("id", revived);
  }

  const cfg = await loadConfig();
  const rescore = await rescoreAll(cfg);

  const summary = {
    feeds_ok: results.length - failed.length,
    feeds_failed: failed.length,
    items_fetched: results.reduce((n, r) => n + r.items.length, 0),
    items_new: inserted?.length ?? 0,
    items_relevant: inserted?.filter((r) => r.prefilter_pass).length ?? 0,
    errors: failed.map((f) => ({ lane: f.lane, error: f.error })),
    finished_at: new Date().toISOString(),
  };
  await db().from("ingestion_runs").update(summary).eq("id", run.id);
  return { run_id: run.id, ...summary, unique_items: items.length, revived: revived.length, rescore };
}

/** Up to EXTRACT_BATCH prefiltered items through Gemini. Returns how many are still waiting. */
export async function extractBatch(limit = EXTRACT_BATCH, budgetMs = 240_000) {
  const deadline = Date.now() + budgetMs;
  const cfg = await loadConfig();
  const { data: items, error } = await db().from("raw_items")
    .select("id, title, snippet, link, source_name, published_at")
    .eq("status", "new").eq("prefilter_pass", true)
    .order("published_at", { ascending: false }).limit(Math.min(limit, EXTRACT_BATCH));
  if (error) throw new Error(`raw_items read: ${error.message}`);

  const { data: run } = await db().from("ingestion_runs").insert({ kind: "extract" }).select("id").single();
  const outcomes: Record<string, number> = { irrelevant: 0, policy: 0, lead_created: 0, lead_updated: 0, error: 0 };
  const errors: { id: string; error: string }[] = [];

  // Sequential: the Gemini client spaces calls for the free-tier rate limit. Stop starting new
  // items once the time budget is nearly used; the rest stay "new" for the next invocation.
  const queue = [...(items ?? [])];
  let attempted = 0;
  const worker = async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      if (Date.now() > deadline - 20_000) break;
      attempted++;
      try {
        const { outcome, extraction } = await processItem({ ...it, raw_item_id: it.id, source_type: "news" }, cfg, new Date(), deadline);
        const key = outcome.kind === "lead" ? (outcome.created ? "lead_created" : "lead_updated") : outcome.kind;
        outcomes[key]++;
        await db().from("raw_items").update({
          status: outcome.kind === "irrelevant" ? "irrelevant" : "extracted",
          extracted_at: new Date().toISOString(), extraction, error: outcome.kind === "irrelevant" ? outcome.reason : null,
        }).eq("id", it.id);
      } catch (e) {
        const msg = (e as Error).message;
        // Timeouts, rate limits and overloads are temporary: leave the item queued for the next batch.
        const transient = /timeout|aborted|\b(429|500|503)\b|quota|rate limited|high demand|fetch failed/i.test(msg);
        outcomes.error++;
        errors.push({ id: it.id, error: msg.slice(0, 300) });
        await db().from("raw_items").update({ status: transient ? "new" : "error", error: msg.slice(0, 500) }).eq("id", it.id);
        if (transient && /429|quota|rate limited/i.test(msg)) break; // rate limited: stop this batch early
      }
    }
  };
  await worker();

  const { count: remaining } = await db().from("raw_items")
    .select("id", { count: "exact", head: true }).eq("status", "new").eq("prefilter_pass", true);
  if (run) {
    await db().from("ingestion_runs").update({
      items_fetched: attempted, items_relevant: outcomes.lead_created + outcomes.lead_updated + outcomes.policy,
      leads_created: outcomes.lead_created, errors, finished_at: new Date().toISOString(),
    }).eq("id", run.id);
  }
  return { processed: attempted, outcomes, errors, remaining: remaining ?? 0 };
}
