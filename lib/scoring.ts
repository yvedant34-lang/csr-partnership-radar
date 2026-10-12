// Deterministic scoring. Gemini never decides tier, score or probability.
// Every number comes from RadarConfig (radar_config row in the database).
// Rules fitted to seed/csr_leads_live.csv; tests/scoring.test.ts recomputes all 15 rows.
import type { GateName, RadarConfig, SignalType, Tier } from "@/lib/config";

export interface LeadInput {
  company_name: string;
  signal_type: SignalType | string;
  posted_at: string; // ISO with offset
  csr_focus_area: string | null;
  city: string | null;
  state: string | null;
  geo_scope: string | null; // city | state | pan_india | other
  programme_states?: string[] | null;
  implementation_partner: string | null;
  budget_inr_cr: number | null;
}

export type Flag = "partner_already_selected" | "implemented_in_house" | "programme_in_home_state";

export interface ScoreResult {
  days_old: number;
  flags: Flag[];
  score_signal: number;
  score_recency: number;
  score_sector_fit: number;
  score_geo_fit: number;
  score_budget_fit: number;
  penalty: number;
  priority_score: number;
  hot_gate_fails: GateName[];
  tier: Tier;
  probability_of_conversion_pct: number;
  proven_funder: boolean;
  recommended_action: string;
}

const NO_PARTNER = /^\s*(|not named|none|not stated|unknown|n\/a)\s*$/i;
const IN_HOUSE = /in[\s-]?house/i;

const GENERIC = new Set(["ltd", "limited", "pvt", "private", "india", "group", "the", "and", "company", "foundation", "industries", "global"]);

/** A company's own foundation (e.g. Birla Cable -> M.P. Birla Foundation) is not an outside partner. */
export function isOwnFoundation(company: string, partner: string): boolean {
  const tokens = company.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !GENERIC.has(t));
  const words = new Set(partner.toLowerCase().split(/[^a-z0-9]+/));
  return tokens.some((t) => words.has(t));
}

const eq = (a: string | null | undefined, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/** Days between posted_at and ref, rounded to one decimal (the CSV's days_old). */
export function daysOld(postedAt: string, ref: Date): number {
  const ms = ref.getTime() - new Date(postedAt).getTime();
  return round1(ms / 86_400_000);
}

export function round1(x: number): number {
  return Number(x.toFixed(1));
}

/** Flags are set by code from extracted fields, never by Gemini. */
export function computeFlags(lead: LeadInput, cfg: RadarConfig): Flag[] {
  const flags: Flag[] = [];
  const partner = lead.implementation_partner ?? "";
  if (IN_HOUSE.test(partner)) flags.push("implemented_in_house");
  else if (!NO_PARTNER.test(partner) && !isOwnFoundation(lead.company_name, partner)) flags.push("partner_already_selected");
  const inHomeState = eq(lead.state, cfg.home_state);
  if (!inHomeState && (lead.programme_states ?? []).some((s) => eq(s, cfg.home_state))) {
    flags.push("programme_in_home_state");
  }
  return flags;
}

export function signalPoints(signal: string, cfg: RadarConfig): number {
  return cfg.signal_points[signal] ?? cfg.signal_points.other ?? 0;
}

/** Unspent CSR and new CSR heads stay relevant longer: their age is divided by slow_decay_factor. */
export function effectiveDays(days: number, signal: string, cfg: RadarConfig): number {
  return cfg.slow_decay_signals.includes(signal) ? days / cfg.slow_decay_factor : days;
}

export function recencyPoints(effDays: number, cfg: RadarConfig): number {
  for (const b of cfg.recency_buckets) if (effDays <= b.max_days) return b.points;
  return 0;
}

export function sectorPoints(area: string | null, cfg: RadarConfig): number {
  if (!area || !cfg.focus_sectors.some((s) => eq(s, area))) return 0;
  const key = Object.keys(cfg.sector_points).find((k) => eq(k, area));
  return key ? cfg.sector_points[key] : 0;
}

export function isHomeCity(city: string | null, cfg: RadarConfig): boolean {
  const c = (city ?? "").toLowerCase();
  return c !== "" && cfg.home_city_aliases.some((a) => c.includes(a.toLowerCase()));
}

export function geoPoints(lead: LeadInput, flags: Flag[], cfg: RadarConfig): number {
  if (isHomeCity(lead.city, cfg)) return cfg.geo_points.home_city;
  if (eq(lead.state, cfg.home_state)) return cfg.geo_points.home_state;
  if (flags.includes("programme_in_home_state")) return cfg.geo_points.programme_in_home_state;
  if (lead.geo_scope === "pan_india") return cfg.geo_points.pan_india;
  return cfg.geo_points.other;
}

export function budgetPoints(cr: number | null, cfg: RadarConfig): number {
  if (cr == null || Number.isNaN(cr)) return cfg.budget_points.unknown;
  if (cr < 1) return cfg.budget_points.under_1_cr;
  if (cr < 10) return cfg.budget_points.from_1_to_10_cr;
  return cfg.budget_points.over_10_cr;
}

export function gateFails(effDays: number, geo: number, flags: Flag[], cfg: RadarConfig): GateName[] {
  const fails: GateName[] = [];
  const on = (g: GateName) => cfg.gates.enabled.includes(g);
  if (on("too_old") && effDays > cfg.gates.too_old_days) fails.push("too_old");
  if (on("outside_footprint") && geo === 0) fails.push("outside_footprint");
  if (on("partner_already_selected") && flags.includes("partner_already_selected")) fails.push("partner_already_selected");
  if (on("implemented_in_house") && flags.includes("implemented_in_house")) fails.push("implemented_in_house");
  return fails;
}

export function tierFor(score: number, fails: GateName[], cfg: RadarConfig): Tier {
  if (score >= cfg.tiers.hot_min && fails.length === 0) return "hot";
  if (score >= cfg.tiers.warm_min) return "warm";
  return "cold";
}

/** A prior from a formula, not a measurement. Shown as "estimate" until enough won/lost outcomes exist. */
export function conversionPrior(score: number, cfg: RadarConfig): number {
  const { base_pct, span_pct } = cfg.conversion_prior;
  return round1(base_pct + span_pct * (score / 100) ** 2);
}

/** Already funds our kind of work, through a partner, in our footprint: the next-cycle pitch list. */
export function provenFunder(lead: LeadInput, flags: Flag[], sector: number, cfg: RadarConfig): boolean {
  const inFootprint = eq(lead.state, cfg.home_state) || flags.includes("programme_in_home_state");
  return flags.includes("partner_already_selected") && inFootprint && sector > 0;
}

export function scoreLead(lead: LeadInput, cfg: RadarConfig, ref: Date = new Date()): ScoreResult {
  const flags = computeFlags(lead, cfg);
  const days = daysOld(lead.posted_at, ref);
  const eff = effectiveDays(days, lead.signal_type, cfg);

  const score_signal = signalPoints(lead.signal_type, cfg);
  const score_recency = recencyPoints(eff, cfg);
  const score_sector_fit = sectorPoints(lead.csr_focus_area, cfg);
  const score_geo_fit = geoPoints(lead, flags, cfg);
  const score_budget_fit = budgetPoints(lead.budget_inr_cr, cfg);
  const penalised = flags.includes("partner_already_selected") || flags.includes("implemented_in_house");
  const penalty = penalised ? cfg.partner_penalty : 0;

  const raw = score_signal + score_recency + score_sector_fit + score_geo_fit + score_budget_fit - penalty;
  const priority_score = Math.max(0, Math.min(100, raw));
  const hot_gate_fails = gateFails(eff, score_geo_fit, flags, cfg);
  const tier = tierFor(priority_score, hot_gate_fails, cfg);

  return {
    days_old: days,
    flags,
    score_signal,
    score_recency,
    score_sector_fit,
    score_geo_fit,
    score_budget_fit,
    penalty,
    priority_score,
    hot_gate_fails,
    tier,
    probability_of_conversion_pct: conversionPrior(priority_score, cfg),
    proven_funder: provenFunder(lead, flags, score_sector_fit, cfg),
    recommended_action: cfg.actions[tier],
  };
}

export const GATE_WORDS: Record<GateName, string> = {
  too_old: "Older than 14 days",
  outside_footprint: "Outside our footprint",
  partner_already_selected: "Partner already selected",
  implemented_in_house: "Runs the programme in house",
};

export function gateWords(g: GateName, cfg: RadarConfig): string {
  return g === "too_old" ? `Older than ${cfg.gates.too_old_days} days` : GATE_WORDS[g];
}
