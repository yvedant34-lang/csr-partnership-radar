import defaults from "@/seed/radar_config.json";

export type SignalType =
  | "partner_search"
  | "csr_tender_or_eoi"
  | "new_initiative"
  | "unspent_csr"
  | "new_csr_head"
  | "event_or_vlog"
  | "annual_report_mention"
  | "other";

export type Tier = "hot" | "warm" | "cold";

export type GateName = "too_old" | "outside_footprint" | "partner_already_selected" | "implemented_in_house";

export interface RadarConfig {
  home_city: string;
  home_city_aliases: string[];
  home_state: string;
  focus_sectors: string[];
  signal_points: Record<string, number>;
  slow_decay_signals: string[];
  slow_decay_factor: number;
  recency_buckets: { max_days: number; points: number }[];
  sector_points: Record<string, number>;
  geo_points: { home_city: number; home_state: number; programme_in_home_state: number; pan_india: number; other: number };
  budget_points: { unknown: number; under_1_cr: number; from_1_to_10_cr: number; over_10_cr: number };
  partner_penalty: number;
  tiers: { hot_min: number; warm_min: number };
  gates: { enabled: GateName[]; too_old_days: number };
  conversion_prior: { base_pct: number; span_pct: number; measured_after_outcomes: number };
  actions: Record<Tier, string>;
  lusha_auto_tiers: Tier[];
  lusha_monthly_cap: number;
  ngo_name: string;
  ngo_outcome: string; // one real programme outcome used in drafts; empty = placeholder, never invented
}

/** Strips the _note/_inferred keys from the JSON file. The DB row (radar_config.config) has the same shape. */
export function normaliseConfig(raw: unknown): RadarConfig {
  const merged = { ...(defaults as object), ...((raw as object) ?? {}) } as Record<string, unknown>;
  for (const k of Object.keys(merged)) if (k.startsWith("_")) delete merged[k];
  return merged as unknown as RadarConfig;
}

export const DEFAULT_CONFIG: RadarConfig = normaliseConfig({});
