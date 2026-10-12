import "server-only";
import { createHash } from "node:crypto";
import { normaliseConfig, type RadarConfig } from "@/lib/config";
import { extract, type Extraction } from "@/lib/gemini";
import { pocFromSource } from "@/lib/poc";
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
export async function processItem(item: SourceItem, cfg: RadarConfig, now = new Date(), deadline?: number): Promise<{ outcome: Outcome; extraction: Extraction; model: string }> {
  const { extraction: ex, model } = await extract(item, deadline);
  const lowConfidence = !item.body; // RSS gives Gemini only a headline and snippet

  if (!ex.relevant) return { outcome: { kind: "irrelevant", reason: "Gemini: not relevant" }, extraction: ex, model };

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
    return { outcome: { kind: "policy", id: data.id }, extraction: ex, model };
  }

  if (!ex.company_name || !ex.signal_type) {
    return { outcome: { kind: "irrelevant", reason: "no company or signal named" }, extraction: ex, model };
  }

  const postedAt = item.published_at ?? now.toISOString();
  const sourceText = [item.title, item.snippet, item.body].filter(Boolean).join(" ");
  const poc = pocFromSource(ex, sourceText);
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
    ...scores,
    updated_at: now.toISOString(),
  };

  // One lead per company, signal type and IST week: update the existing row if there is one.
  const weekStart = weekStartIst(new Date(postedAt));
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const { data: existing, error: findErr } = await db().from("leads")
    .select("id, lead_id")
    .ilike("company_name", ex.company_name.replace(/[%_]/g, "\\$&"))
    .eq("signal_type", ex.signal_type)
    .gte("posted_at", weekStart.toISOString())
    .lt("posted_at", weekEnd.toISOString())
    .maybeSingle();
  if (findErr) throw new Error(`leads lookup: ${findErr.message}`);

  if (existing) {
    // Keep the first source; only refresh scores and fill gaps.
    const { error } = await db().from("leads").update({ ...scores, updated_at: row.updated_at }).eq("id", existing.id);
    if (error) throw new Error(`leads update: ${error.message}`);
    return { outcome: { kind: "lead", id: existing.id, lead_id: existing.lead_id, created: false, tier: scores.tier, score: scores.priority_score }, extraction: ex, model };
  }

  const lead_id = leadCode(ex.company_name, ex.signal_type, postedAt);
  const { data: inserted, error } = await db().from("leads").insert({ ...row, lead_id }).select("id").single();
  if (error) throw new Error(`leads insert: ${error.message}`);
  await db().from("lead_stage_events").insert({ lead_id: inserted.id, from_stage: null, to_stage: "new", changed_at: now.toISOString() });
  if (poc.name) {
    await db().from("lead_contacts").insert({ lead_id: inserted.id, source: "source_text", name: poc.name, title: poc.designation });
  }
  if (scores.tier === "hot") await onNewHotLead(inserted.id, ex.company_name, now);

  return { outcome: { kind: "lead", id: inserted.id, lead_id, created: true, tier: scores.tier, score: scores.priority_score }, extraction: ex, model };
}

/** Every new hot lead gets a call task due the coming Monday. Drafts are added in lib/drafts.ts (Phase 4). */
export async function onNewHotLead(leadId: string, company: string, now = new Date()) {
  const { error } = await db().from("tasks").insert({
    lead_id: leadId,
    kind: "call",
    title: `Call ${company}`,
    due_date: comingMonday(now),
  });
  if (error) throw new Error(`tasks insert: ${error.message}`);
}

/** Recompute every lead from the current radar_config. Recency decays daily, so the ingest cron runs this too. */
export async function rescoreAll(cfg: RadarConfig, now = new Date()) {
  const { data: leads, error } = await db().from("leads").select(
    "id, company_name, signal_type, posted_at, csr_focus_area, city, state, geo_scope, programme_states, implementation_partner, budget_inr_cr, tier",
  );
  if (error) throw new Error(`rescore read: ${error.message}`);
  let changedTier = 0;
  for (const l of leads ?? []) {
    const scores = scoreFields({ ...l, budget_inr_cr: l.budget_inr_cr == null ? null : Number(l.budget_inr_cr) }, cfg, now);
    if (scores.tier !== l.tier) changedTier++;
    const { error: upErr } = await db().from("leads").update(scores).eq("id", l.id);
    if (upErr) throw new Error(`rescore ${l.id}: ${upErr.message}`);
  }
  return { rescored: leads?.length ?? 0, changedTier };
}

export { SCORE_FIELDS };
