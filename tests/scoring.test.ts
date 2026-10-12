import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/config";
import { parseCsv } from "@/lib/csv";
import { scoreLead, type LeadInput } from "@/lib/scoring";

const REF = new Date("2026-10-12T18:00:00+05:30");
const rows = parseCsv(readFileSync(path.join(__dirname, "../seed/csr_leads_live.csv"), "utf8"));

// The CSV has no programme_states column. Zeta's comes from the documented Gemini example in the brief.
const PROGRAMME_STATES: Record<string, string[]> = { "LIVE-001": ["Telangana", "Karnataka", "Maharashtra"] };

const split = (s: string) => (s ? s.split(";") : []);

function toInput(r: Record<string, string>): LeadInput {
  return {
    company_name: r.company_name,
    signal_type: r.signal_type,
    posted_at: r.posted_at,
    csr_focus_area: r.csr_focus_area,
    city: r.city,
    state: r.state,
    geo_scope: r.geo_scope,
    programme_states: PROGRAMME_STATES[r.lead_id] ?? [],
    implementation_partner: r.implementation_partner,
    budget_inr_cr: r.budget_inr_cr === "" ? null : Number(r.budget_inr_cr),
  };
}

describe("scoring reproduces csr_leads_live.csv", () => {
  it("has 15 live rows", () => expect(rows).toHaveLength(15));

  for (const r of rows) {
    it(`${r.lead_id} ${r.company_name}: ${r.priority_score} ${r.tier}`, () => {
      const s = scoreLead(toInput(r), DEFAULT_CONFIG, REF);
      expect(s.priority_score).toBe(Number(r.priority_score));
      expect(s.tier).toBe(r.tier);
      expect({
        signal: s.score_signal, recency: s.score_recency, sector: s.score_sector_fit,
        geo: s.score_geo_fit, budget: s.score_budget_fit,
      }).toEqual({
        signal: Number(r.score_signal), recency: Number(r.score_recency), sector: Number(r.score_sector_fit),
        geo: Number(r.score_geo_fit), budget: Number(r.score_budget_fit),
      });
      expect(s.flags).toEqual(split(r.flags));
      expect(s.hot_gate_fails).toEqual(split(r.hot_gate_fails));
      expect(s.days_old).toBe(Number(r.days_old));
      expect(s.probability_of_conversion_pct).toBe(Number(r.probability_of_conversion_pct));
      expect(s.proven_funder).toBe(r.proven_funder === "True");
      expect(s.recommended_action).toBe(r.recommended_action);
      expect(s.tier === "hot").toBe(r.call_this_week === "True");
    });
  }

  it("finds 0 hot leads, as the brief says", () => {
    const hot = rows.filter((r) => scoreLead(toInput(r), DEFAULT_CONFIG, REF).tier === "hot");
    expect(hot).toHaveLength(0);
  });
});

describe("config drives scoring", () => {
  const basf = toInput(rows.find((r) => r.lead_id === "LIVE-008")!);

  it("moves BASF to hot when hot_min drops to 70", () => {
    const cfg = { ...DEFAULT_CONFIG, tiers: { ...DEFAULT_CONFIG.tiers, hot_min: 70 } };
    expect(scoreLead(basf, cfg, REF).tier).toBe("hot");
  });

  it("changes geography when home state changes", () => {
    const cfg = { ...DEFAULT_CONFIG, home_state: "Karnataka", home_city_aliases: ["Bengaluru"] };
    expect(scoreLead(basf, cfg, REF).score_geo_fit).toBe(0);
  });

  it("an open partner search in Pune today is hot", () => {
    const s = scoreLead(
      { company_name: "Test Co", signal_type: "partner_search", posted_at: "2026-10-12T09:00:00+05:30", csr_focus_area: "Skill Development",
        city: "Pune", state: "Maharashtra", geo_scope: "city", implementation_partner: null, budget_inr_cr: null },
      DEFAULT_CONFIG, REF,
    );
    expect(s.tier).toBe("hot");
    expect(s.hot_gate_fails).toEqual([]);
  });
});
