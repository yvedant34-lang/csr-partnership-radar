import "server-only";
import { createHash } from "node:crypto";
import { normaliseConfig, type RadarConfig } from "@/lib/config";
import { extract, type Extraction } from "@/lib/gemini";
import { pocFromSource } from "@/lib/poc";
import { readArticle } from "@/lib/article";
import { draftOutreach, saveDraftTask } from "@/lib/drafts";
import { autoEnrich } from "@/lib/lusha";
import { scoreLead, type LeadInput } from "@/lib/scoring";
import { db } from "@/lib/supabase/server";
import { comingMonday, weekStartIst } from "@/lib/week";

export async function loadConfig(): Promise<RadarConfig> {
  const { data, error } = await db().from("radar_config").select("config").eq("id", 1).maybeSingle();
  if (error) throw new Error(`radar_config: ${error.message}`);
  return normaliseConfig(data?.config ?? {});
}

export interface SourceItem {
  raw_item_id?: string | null;
  source_url?: string | null; // publisher URL when known
  title: string;
  snippet?: string | null;
  body?: string | null; // full page text (Paste a link); absent for RSS
  link: string;
  source_name?: string | null;
  source_type?: string; // news | paste | linkedin
  published_at?: string | null;
}

export type Outcome =
  | { kind: "irrelevant"; reason: string }
  | { kind: "policy"; id: string }
  | { kind: "lead"; id: string; lead_id: string; created: boolean; tier: string; score: number };

const SCORE_FIELDS = [
  "priority_score", "probability_of_conversion_pct", "tier", "score_signal", "score_recency", "score_sector_fit",
  "score_geo_fit", "score_budget_fit", "flags", "hot_gate_fails", "proven_funder", "recommended_action",
] as const;

export function scoreFields(input: LeadInput, cfg: RadarConfig, now = new Date()) {
  const s = scoreLead(input, cfg, now);
  return {
    priority_score: s.priority_score,
    probability_of_conversion_pct: s.probability_of_conversion_pct,
    tier: s.tier,
    score_signal: s.score_signal,
    score_recency: s.score_recency,
    score_sector_fit: s.score_sector_fit,
    score_geo_fit: s.score_geo_fit,
    score_budget_fit: s.score_budget_fit,
    flags: s.flags,
    hot_gate_fails: s.hot_gate_fails,
    proven_funder: s.proven_funder,
    recommended_action: s.recommended_action,
    scored_at: now.toISOString(),
  };
}

function leadCode(company: string, signal: string, postedAt: string): string {
  const week = weekStartIst(new Date(postedAt)).toISOString().slice(0, 10);
  return "RSS-" + createHash("sha1").update(`${company.toLowerCase()}|${signal}|${week}`).digest("hex").slice(0, 8);
}

/** Extract, then write a policy update or a scored lead. Same path for cron items and Paste a link. */
export async function processItem(item: SourceItem, cfg: RadarConfig, now = new Date(), deadline?: number): Promise<{ outcome: Outcome; extraction: Extraction; model: string; article: { url: string | null; chars: number; error?: string } }> {
  // Read the full article behind the Google News link. Falls back to the headline (low confidence).
  let article: { url: string | null; chars: number; error?: string } = { url: item.source_url ?? null, chars: item.body?.length ?? 0 };
  if (!item.body && /news\.google\.com/.test(item.link)) {
    const read = await readArticle(item.link);
    article = { url: read.url, chars: read.text?.length ?? 0, error: read.error };
    if (read.text) item = { ...item, body: read.text, source_url: read.url };
  }
  const { extraction: ex, model } = await extract(item, deadline);
  const lowConfidence = !item.body;

  // A lead made earlier from this same item (e.g. headline-only, before the article was read).
  const { data: prior } = item.raw_item_id
    ? await db().from("leads").select("id, lead_id, article_read, tier").eq("raw_item_id", item.raw_item_id).maybeSingle()
    : { data: null };
  const dropStalePrior = async () => {
    if (prior && !prior.article_read && !lowConfidence && String(prior.lead_id).startsWith("RSS-")) {
      await db().from("leads").delete().eq("id", prior.id);
    }
  };

  if (!ex.relevant) {
    await dropStalePrior();
    return { outcome: { kind: "irrelevant", reason: "Gemini: not relevant" }, extraction: ex, model, article };
  }

  if (ex.is_policy) {
    const { data, error } = await db().from("policy_updates").insert({
      raw_item_id: item.raw_item_id ?? null,
      title: item.title,
      source_name: item.source_name ?? null,
      link: item.link,
      published_at: item.published_at ?? now.toISOString(),
      summary: ex.summary,
      impact_on_us: ex.policy_impact,
      action: ex.policy_action,
    }).select("id").single();
    if (error) throw new Error(`policy_updates: ${error.message}`);
    await dropStalePrior();
    return { outcome: { kind: "policy", id: data.id }, extraction: ex, model, article };
  }

  if (!ex.company_name || !ex.signal_type) {
    await dropStalePrior();
    return { outcome: { kind: "irrelevant", reason: "no company or signal named" }, extraction: ex, model, article };
  }

  const postedAt = item.published_at ?? now.toISOString();
  const sourceText = [item.title, item.snippet, item.body].filter(Boolean).join(" ");
  // The post's owner: the named company contact, else the CSR head or spokesperson the article names.
  let poc = pocFromSource(ex, sourceText);
  const people = (ex.people ?? []).filter((p) => pocFromSource({ poc_name: p.name, poc_designation: p.designation }, sourceText).name);
  if (!poc.name) {
    const lead = people.find((p) => p.role === "csr_head") ?? people.find((p) => p.role === "spokesperson") ?? people.find((p) => p.role === "executive");
    if (lead) poc = { name: lead.name, designation: lead.designation };
  }
  const input: LeadInput = {
    company_name: ex.company_name,
    signal_type: ex.signal_type,
    posted_at: postedAt,
    csr_focus_area: ex.csr_focus_area === "Other" ? null : ex.csr_focus_area,
    city: ex.city,
    state: ex.state,
    geo_scope: ex.geo_scope,
    programme_states: ex.programme_states ?? [],
    implementation_partner: ex.implementation_partner,
    budget_inr_cr: ex.budget_inr_cr,
  };
  const scores = scoreFields(input, cfg, now);
  const row = {
    raw_item_id: item.raw_item_id ?? null,
    company_name: ex.company_name,
    industry: ex.industry,
    csr_focus_area: ex.csr_focus_area,
    city: ex.city,
    state: ex.state,
    geo_scope: ex.geo_scope,
    programme_states: ex.programme_states ?? [],
    poc_name: poc.name,
    poc_designation: poc.designation,
    contact_source: poc.name
      ? (item.body ? "Named in source" : "Named in headline")
      : "Not published in source. Find via company CSR policy page or annual report.",
    source_type: item.source_type ?? "news",
    source_name: item.source_name ?? null,
    post_link: item.link,
    signal_type: ex.signal_type,
    budget_inr_cr: ex.budget_inr_cr,
    budget_basis: ex.budget_inr_cr == null ? "unknown" : "stated",
    posted_at: postedAt,
    posted_time_precision: "time",
    implementation_partner: ex.implementation_partner,
    beneficiaries: ex.beneficiaries,
    summary: ex.summary,
    why_now: ex.why_now,
    extraction_confidence: lowConfidence ? "low" : "high",
    source_url: item.source_url ?? article.url ?? null,
    article_read: !lowConfidence,
    people,
    outreach_channel: ex.outreach?.channel ?? null,
    outreach_angle: ex.outreach?.angle ?? null,
    outreach_first_line: ex.outreach?.first_line ?? null,
    outreach_ask: ex.outreach?.ask ?? null,
    ...scores,
    updated_at: now.toISOString(),
  };

  // One lead per company, signal type and IST week: update the existing row if there is one.
  const weekStart = weekStartIst(new Date(postedAt));
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const { data: sameWeek, error: findErr } = await db().from("leads")
    .select("id, lead_id, article_read, tier")
    .ilike("company_name", ex.company_name.replace(/[%_]/g, "\\$&"))
    .eq("signal_type", ex.signal_type)
    .gte("posted_at", weekStart.toISOString())
    .lt("posted_at", weekEnd.toISOString())
    .maybeSingle();
  if (findErr) throw new Error(`leads lookup: ${findErr.message}`);
  if (sameWeek && prior && sameWeek.id !== prior.id) await dropStalePrior(); // merged into another lead
  const existing = sameWeek ?? prior;

  if (existing) {
    // A full-article read replaces a headline-only RSS lead. Verified seed rows (LIVE-*) are never overwritten.
    const upgrade = !existing.article_read && !lowConfidence && !String(existing.lead_id).startsWith("LIVE-");
    let patch: Record<string, unknown> = row;
    if (!upgrade) {
      // Same story seen again: keep the stored facts and rescore from them, not from this extraction.
      const { data: stored } = await db().from("leads").select(
        "company_name, signal_type, posted_at, csr_focus_area, city, state, geo_scope, programme_states, implementation_partner, budget_inr_cr",
      ).eq("id", existing.id).single();
      const kept = scoreFields({ ...stored!, budget_inr_cr: stored!.budget_inr_cr == null ? null : Number(stored!.budget_inr_cr) }, cfg, now);
      Object.assign(scores, kept);
      patch = { ...kept, updated_at: row.updated_at };
    }
    const { error } = await db().from("leads").update(patch).eq("id", existing.id);
    if (error) throw new Error(`leads update: ${error.message}`);
    if (upgrade && poc.name) {
      await db().from("lead_contacts").delete().eq("lead_id", existing.id).eq("source", "source_text");
      await db().from("lead_contacts").insert({ lead_id: existing.id, source: "source_text", name: poc.name, title: poc.designation });
    }
    // Became hot (or newly qualifies for contact lookup) on this read: same actions as a new lead.
    if (scores.tier !== existing.tier) await onTierReached(existing.id, ex.company_name, upgrade ? poc.name : null, scores.tier, cfg, now);
    return { outcome: { kind: "lead", id: existing.id, lead_id: existing.lead_id, created: false, tier: scores.tier, score: scores.priority_score }, extraction: ex, model, article };
  }

  const lead_id = leadCode(ex.company_name, ex.signal_type, postedAt);
  const { data: inserted, error } = await db().from("leads").insert({ ...row, lead_id }).select("id").single();
  if (error) throw new Error(`leads insert: ${error.message}`);
  await db().from("lead_stage_events").insert({ lead_id: inserted.id, from_stage: null, to_stage: "new", changed_at: now.toISOString() });
  if (poc.name) {
    await db().from("lead_contacts").insert({ lead_id: inserted.id, source: "source_text", name: poc.name, title: poc.designation });
  }
  await onTierReached(inserted.id, ex.company_name, poc.name, scores.tier, cfg, now);

  return { outcome: { kind: "lead", id: inserted.id, lead_id, created: true, tier: scores.tier, score: scores.priority_score }, extraction: ex, model, article };
}

/**
 * Actions when a lead is created or moves into a tier: hot gets a call task with drafts; tiers in
 * radar_config.lusha_auto_tiers get the post owner's contact details from Lusha. Never blocks the lead.
 */
export async function onTierReached(leadId: string, company: string, pocName: string | null, tier: string, cfg: RadarConfig, now = new Date()) {
  if (tier === "hot") {
    const { count } = await db().from("tasks").select("id", { count: "exact", head: true }).eq("lead_id", leadId).eq("status", "open");
    if (!count) await onNewHotLead(leadId, company, cfg, now);
  }
  try {
    const { count } = await db().from("lead_contacts").select("id", { count: "exact", head: true }).eq("lead_id", leadId).eq("source", "lusha");
    if (!count) await autoEnrich({ id: leadId, company_name: company, poc_name: pocName, tier }, cfg);
  } catch (e) {
    console.warn(`lusha ${company}: ${(e as Error).message}`);
  }
}

/** Every new hot lead gets a call task due the coming Monday, an intro email and a call opener. */
export async function onNewHotLead(leadId: string, company: string, cfg: RadarConfig, now = new Date()) {
  try {
    const { draft, model } = await draftOutreach(leadId, cfg);
    await saveDraftTask(leadId, company, draft, model, now);
  } catch (e) {
    // Quota or model trouble: still create the task so the call is not missed; drafts can be retried.
    console.warn(`draft ${company}: ${(e as Error).message}`);
    await db().from("tasks").insert({ lead_id: leadId, kind: "call", title: `Call ${company}`, due_date: comingMonday(now) });
  }
}

/** Recompute every lead from the current radar_config. Recency decays daily, so the ingest cron runs this too. */
export async function rescoreAll(cfg: RadarConfig, now = new Date()) {
  const { data: leads, error } = await db().from("leads").select(
    "id, company_name, signal_type, posted_at, csr_focus_area, city, state, geo_scope, programme_states, implementation_partner, budget_inr_cr, tier, poc_name, is_synthetic",
  );
  if (error) throw new Error(`rescore read: ${error.message}`);
  let changedTier = 0;
  for (const l of leads ?? []) {
    const scores = scoreFields({ ...l, budget_inr_cr: l.budget_inr_cr == null ? null : Number(l.budget_inr_cr) }, cfg, now);
    const { error: upErr } = await db().from("leads").update(scores).eq("id", l.id);
    if (upErr) throw new Error(`rescore ${l.id}: ${upErr.message}`);
    if (scores.tier !== l.tier) {
      changedTier++;
      if (scores.tier === "hot" && !l.is_synthetic) await onTierReached(l.id, l.company_name, l.poc_name, scores.tier, cfg, now);
    }
  }
  return { rescored: leads?.length ?? 0, changedTier };
}

export { SCORE_FIELDS };
