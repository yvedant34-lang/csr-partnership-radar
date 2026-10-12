import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/config";
import { nextActions, type ActionLead } from "@/lib/next-actions";

const NOW = new Date("2026-10-12T19:00:00+05:30"); // Monday
const base: ActionLead = {
  id: "l1", company_name: "Bharat Electronics", tier: "hot", priority_score: 75, probability_of_conversion_pct: 23.4,
  signal_type: "unspent_csr", pipeline_stage: "new", proven_funder: false, score_geo_fit: 15, article_read: true, poc_name: "Manoj Jain",
  budget_inr_cr: 75.21, hot_gate_fails: [], flags: [], outreach_channel: "email", post_link: "https://news.google.com/x",
};
const keys = (a: { key: string }[]) => a.map((x) => x.key);

describe("next actions", () => {
  it("hot with no contact: find the contact first, then email and call this Monday", () => {
    const a = nextActions(base, [], [], DEFAULT_CONFIG, NOW);
    expect(keys(a)).toEqual(["find_contact", "email", "call"]);
    expect(a.find((x) => x.key === "call")!.due).toBe("2026-10-12");
    expect(a[0].why).toContain("estimate 23.4%");
  });
  it("hot with a Lusha contact but no email: reveal it", () => {
    const a = nextActions(base, [{ id: "c1", source: "lusha", name: "Vidya J", email: null, linkedin: "https://linkedin.com/in/x", can_reveal: ["emails"] }], [], DEFAULT_CONFIG, NOW);
    expect(keys(a)).toEqual(["reveal_email", "email", "linkedin", "call"]);
  });
  it("never suggests spending a credit on a related (non-CSR) role", () => {
    const a = nextActions(base, [{ id: "c2", source: "lusha", match: "adjacent_role", name: "R G", email: null, linkedin: null, can_reveal: ["emails"] }], [], DEFAULT_CONFIG, NOW);
    expect(a.map((x) => x.key)).not.toContain("reveal_email");
  });
  it("a draft removes the draft button and done tasks tick off", () => {
    const a = nextActions(base, [{ id: "c1", source: "lusha", name: "Vidya J", email: "v@x.in", linkedin: null, can_reveal: [] }],
      [{ action_key: null, kind: "call", status: "done", email_draft: "Hello" }], DEFAULT_CONFIG, NOW);
    expect(a.find((x) => x.key === "email")!.cta).toBeNull();
    expect(a.find((x) => x.key === "call")!.done).toBe(true);
  });
  it("cold explains what holds it back in plain words", () => {
    const a = nextActions({ ...base, tier: "cold", priority_score: 40, hot_gate_fails: ["too_old", "outside_footprint"] }, [], [], DEFAULT_CONFIG, NOW);
    expect(a[0].key).toBe("nurture");
    expect(a[0].why).toContain("older than 14 days");
  });
  it("partner already chosen: pitch the next financial year before January", () => {
    const a = nextActions({ ...base, tier: "warm", flags: ["partner_already_selected"], proven_funder: true }, [], [], DEFAULT_CONFIG, NOW);
    const pitch = a.find((x) => x.key === "pitch_next_cycle")!;
    expect(pitch.title).toContain("FY28");
    expect(pitch.due).toBe("2026-12-15");
  });
  it("out-of-footprint cold lead with a partner chosen: nurture, not a pitch", () => {
    const a = nextActions({ ...base, tier: "cold", score_geo_fit: 0, flags: ["partner_already_selected"], hot_gate_fails: ["outside_footprint"] }, [], [], DEFAULT_CONFIG, NOW);
    expect(a.map((x) => x.key)).toEqual(["nurture"]);
  });
  it("stages drive follow ups", () => {
    expect(keys(nextActions({ ...base, pipeline_stage: "contacted" }, [], [], DEFAULT_CONFIG, NOW))).toContain("follow_up");
    expect(keys(nextActions({ ...base, pipeline_stage: "lost" }, [], [], DEFAULT_CONFIG, NOW))).toEqual([]);
    expect(keys(nextActions({ ...base, pipeline_stage: "won" }, [], [], DEFAULT_CONFIG, NOW))).toEqual(["invoice"]);
    expect(keys(nextActions({ ...base, pipeline_stage: "ghosted" }, [], [], DEFAULT_CONFIG, NOW))).toEqual(["last_try"]);
  });
});
